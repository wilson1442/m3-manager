from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
import aiohttp
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import asyncio
import subprocess
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Initialize scheduler
scheduler = AsyncIOScheduler()

# Background task to refresh M3U playlists
async def refresh_m3u_playlists():
    """Fetch M3U content from URLs and update database"""
    logger.info("Starting M3U playlist refresh...")
    try:
        playlists = await db.m3u_playlists.find({}).to_list(1000)
        
        async with aiohttp.ClientSession() as session:
            for playlist in playlists:
                try:
                    # Fetch content from URL
                    async with session.get(playlist['url'], timeout=aiohttp.ClientTimeout(total=30)) as response:
                        if response.status == 200:
                            content = await response.text()
                            
                            # Update playlist content and timestamp
                            await db.m3u_playlists.update_one(
                                {"id": playlist['id']},
                                {
                                    "$set": {
                                        "content": content,
                                        "updated_at": datetime.now(timezone.utc).isoformat(),
                                        "last_refresh": datetime.now(timezone.utc).isoformat()
                                    }
                                }
                            )
                            logger.info(f"Refreshed playlist: {playlist['name']}")
                        else:
                            logger.warning(f"Failed to refresh {playlist['name']}: HTTP {response.status}")
                except Exception as e:
                    logger.error(f"Error refreshing playlist {playlist['name']}: {str(e)}")
        
        logger.info("M3U playlist refresh completed")
    except Exception as e:
        logger.error(f"Error in refresh_m3u_playlists: {str(e)}")

def parse_m3u_content(content: str) -> List[dict]:
    """Parse M3U content and extract channel information"""
    channels = []
    if not content:
        return channels
    
    lines = content.strip().split('\n')
    current_channel = {}
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        if line.startswith('#EXTINF:'):
            # Parse channel metadata
            # Format: #EXTINF:-1 tvg-logo="logo.png" group-title="Sports",Channel Name
            current_channel = {}
            
            # Extract logo
            if 'tvg-logo="' in line:
                start = line.index('tvg-logo="') + 10
                end = line.index('"', start)
                current_channel['logo'] = line[start:end]
            
            # Extract group
            if 'group-title="' in line:
                start = line.index('group-title="') + 13
                end = line.index('"', start)
                current_channel['group'] = line[start:end]
            
            # Extract channel name (after last comma)
            if ',' in line:
                current_channel['name'] = line.split(',', 1)[1].strip()
            
        elif line and not line.startswith('#') and current_channel:
            # This is the stream URL
            current_channel['url'] = line
            channels.append(current_channel)
            current_channel = {}
    
    return channels

async def probe_stream(url: str) -> dict:
    """Check if a stream is online and extract metadata"""
    result = {
        "url": url,
        "online": False,
        "response_time": None,
        "error": None,
        "bitrate": None,
        "resolution": None,
        "audio_codec": None,
        "video_codec": None,
        "stream_type": None,
        "variants": []
    }
    
    try:
        start_time = datetime.now()
        async with aiohttp.ClientSession() as session:
            # First, try to fetch the stream
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10), allow_redirects=True) as response:
                end_time = datetime.now()
                result["response_time"] = (end_time - start_time).total_seconds()
                
                if response.status in [200, 206, 302, 301]:
                    result["online"] = True
                    
                    # Check if it's an M3U8/HLS stream
                    content_type = response.headers.get('Content-Type', '')
                    if 'mpegurl' in content_type or 'x-mpegURL' in content_type or url.endswith('.m3u8') or url.endswith('.m3u'):
                        result["stream_type"] = "HLS"
                        
                        # Parse M3U8 manifest
                        try:
                            manifest_content = await response.text()
                            result = parse_m3u8_manifest(manifest_content, result)
                        except Exception as e:
                            logger.error(f"Error parsing M3U8 manifest: {str(e)}")
                    
                    elif 'video' in content_type or 'audio' in content_type:
                        result["stream_type"] = content_type
                        
                        # Try to get content length for bitrate estimation
                        content_length = response.headers.get('Content-Length')
                        if content_length:
                            size_mb = int(content_length) / (1024 * 1024)
                            result["bitrate"] = f"~{size_mb:.1f} MB total"
                    
                else:
                    result["error"] = f"HTTP {response.status}"
                    
    except asyncio.TimeoutError:
        result["error"] = "Timeout"
    except Exception as e:
        result["error"] = str(e)
    
    return result

def parse_m3u8_manifest(content: str, result: dict) -> dict:
    """Parse M3U8 manifest to extract stream information"""
    lines = content.strip().split('\n')
    
    variants = []
    current_variant = {}
    
    for line in lines:
        line = line.strip()
        
        # Parse bandwidth and resolution from EXT-X-STREAM-INF
        if line.startswith('#EXT-X-STREAM-INF:'):
            current_variant = {}
            
            # Extract BANDWIDTH
            if 'BANDWIDTH=' in line:
                bandwidth_start = line.index('BANDWIDTH=') + 10
                bandwidth_end = line.find(',', bandwidth_start)
                if bandwidth_end == -1:
                    bandwidth_end = len(line)
                bandwidth = line[bandwidth_start:bandwidth_end]
                try:
                    bandwidth_kbps = int(bandwidth) / 1000
                    current_variant['bitrate'] = f"{bandwidth_kbps:.0f} kbps"
                except:
                    pass
            
            # Extract RESOLUTION
            if 'RESOLUTION=' in line:
                resolution_start = line.index('RESOLUTION=') + 11
                resolution_end = line.find(',', resolution_start)
                if resolution_end == -1:
                    resolution_end = line.find(' ', resolution_start)
                if resolution_end == -1:
                    resolution_end = len(line)
                current_variant['resolution'] = line[resolution_start:resolution_end]
            
            # Extract CODECS
            if 'CODECS=' in line:
                codecs_start = line.index('CODECS="') + 8
                codecs_end = line.index('"', codecs_start)
                codecs = line[codecs_start:codecs_end]
                
                # Parse codecs (usually format: "avc1.xxxxx,mp4a.xx.x")
                codec_parts = codecs.split(',')
                for codec in codec_parts:
                    codec = codec.strip()
                    if codec.startswith('avc') or codec.startswith('hvc') or codec.startswith('vp'):
                        current_variant['video_codec'] = codec
                    elif codec.startswith('mp4a') or codec.startswith('ac-3') or codec.startswith('ec-3'):
                        current_variant['audio_codec'] = codec
        
        elif line and not line.startswith('#') and current_variant:
            # This is a variant URL
            variants.append(current_variant)
            current_variant = {}
    
    if variants:
        result["variants"] = variants
        
        # Set the highest quality variant as the main info
        # Sort by bitrate
        variants_with_bitrate = [v for v in variants if 'bitrate' in v]
        if variants_with_bitrate:
            highest_quality = max(variants_with_bitrate, 
                                key=lambda x: int(x['bitrate'].replace(' kbps', '')))
            result["bitrate"] = highest_quality.get('bitrate')
            result["resolution"] = highest_quality.get('resolution')
            result["video_codec"] = highest_quality.get('video_codec')
            result["audio_codec"] = highest_quality.get('audio_codec')
    
    # Also check for single stream info
    if not variants:
        for line in lines:
            if line.startswith('#EXT-X-TARGETDURATION:'):
                result["stream_type"] = "HLS (Single)"
    
    return result

async def fetch_player_api_data(player_api_url: str) -> dict:
    """Fetch data from player API URL"""
    result = {
        "max_connections": None,
        "active_connections": None,
        "expiration_date": None,
        "error": None
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(player_api_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Check if data is nested under user_info (common format)
                    user_info = data.get("user_info", data)
                    
                    # Extract max connections
                    max_conn = user_info.get("max_connections") or user_info.get("maxConnections") or user_info.get("max_cons")
                    if max_conn:
                        result["max_connections"] = int(max_conn) if isinstance(max_conn, str) else max_conn
                    
                    # Extract active connections
                    active_conn = user_info.get("active_cons") or user_info.get("active_connections") or user_info.get("activeConnections")
                    if active_conn:
                        result["active_connections"] = int(active_conn) if isinstance(active_conn, str) else active_conn
                    
                    # Extract expiration date
                    exp_date = user_info.get("exp_date") or user_info.get("expiration_date") or user_info.get("expires")
                    if exp_date:
                        # If it's a Unix timestamp (string or int)
                        try:
                            timestamp = int(exp_date) if isinstance(exp_date, str) else exp_date
                            exp_dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                            # Format as MM/DD/YYYY
                            result["expiration_date"] = exp_dt.strftime("%m/%d/%Y")
                        except (ValueError, TypeError):
                            # If it's already a formatted string, use it
                            result["expiration_date"] = str(exp_date)
                else:
                    result["error"] = f"HTTP {response.status}"
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Error fetching player API data: {str(e)}")
    
    return result

async def probe_stream_ffmpeg(url: str) -> dict:
    """Use FFmpeg/ffprobe to get detailed stream information"""
    result = {
        "url": url,
        "online": False,
        "status": "unknown",
        "format": None,
        "duration": None,
        "bitrate": None,
        "video_codec": None,
        "video_resolution": None,
        "video_fps": None,
        "audio_codec": None,
        "audio_sample_rate": None,
        "audio_channels": None,
        "error": None,
        "raw_data": {}
    }
    
    try:
        # Run ffprobe with JSON output
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            '-timeout', '10000000',  # 10 seconds timeout in microseconds
            url
        ]
        
        # Run ffprobe
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=15)
        
        if process.returncode == 0:
            # Parse JSON output
            data = json.loads(stdout.decode('utf-8'))
            result["raw_data"] = data
            result["online"] = True
            result["status"] = "online"
            
            # Extract format information
            if 'format' in data:
                fmt = data['format']
                result["format"] = fmt.get('format_long_name') or fmt.get('format_name')
                if 'duration' in fmt:
                    try:
                        duration_sec = float(fmt['duration'])
                        result["duration"] = f"{int(duration_sec // 60)}:{int(duration_sec % 60):02d}"
                    except:
                        pass
                if 'bit_rate' in fmt:
                    try:
                        bitrate_kbps = int(fmt['bit_rate']) / 1000
                        result["bitrate"] = f"{bitrate_kbps:.0f} kbps"
                    except:
                        pass
            
            # Extract stream information
            if 'streams' in data:
                for stream in data['streams']:
                    codec_type = stream.get('codec_type')
                    
                    if codec_type == 'video' and not result["video_codec"]:
                        result["video_codec"] = stream.get('codec_long_name') or stream.get('codec_name')
                        
                        # Get resolution
                        width = stream.get('width')
                        height = stream.get('height')
                        if width and height:
                            result["video_resolution"] = f"{width}x{height}"
                        
                        # Get FPS
                        fps = stream.get('r_frame_rate')
                        if fps:
                            try:
                                # fps is usually in format "30/1" or "30000/1001"
                                num, den = fps.split('/')
                                fps_val = int(num) / int(den)
                                result["video_fps"] = f"{fps_val:.2f} fps"
                            except:
                                pass
                    
                    elif codec_type == 'audio' and not result["audio_codec"]:
                        result["audio_codec"] = stream.get('codec_long_name') or stream.get('codec_name')
                        
                        # Get sample rate
                        sample_rate = stream.get('sample_rate')
                        if sample_rate:
                            result["audio_sample_rate"] = f"{int(sample_rate) / 1000:.1f} kHz"
                        
                        # Get channels
                        channels = stream.get('channels')
                        if channels:
                            result["audio_channels"] = f"{channels} ch"
        else:
            # Error occurred
            error_msg = stderr.decode('utf-8') if stderr else "Unknown error"
            result["status"] = "offline"
            result["error"] = f"FFprobe error: {error_msg[:200]}"
            
    except asyncio.TimeoutError:
        result["status"] = "timeout"
        result["error"] = "Stream connection timeout (15s)"
    except Exception as e:
        result["status"] = "error"
        result["error"] = f"Error: {str(e)}"
        logger.error(f"Error probing stream with ffmpeg: {str(e)}")
    
    return result

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    name: Optional[str] = None  # Display name
    role: str  # super_admin, tenant_owner, user
    tenant_id: Optional[str] = None
    theme: str = "light"  # light or dark
    profile_image: Optional[str] = None  # base64 encoded PNG
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    name: Optional[str] = None
    role: Optional[str] = "user"
    tenant_id: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    profile_image: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Tenant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    owner_id: str
    expiration_date: Optional[datetime] = Field(default_factory=lambda: datetime(2025, 12, 1, tzinfo=timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class TenantCreate(BaseModel):
    name: str
    owner_username: str
    owner_password: str
    expiration_date: Optional[str] = None  # Format: "YYYY-MM-DD"

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    expiration_date: Optional[str] = None

class M3UPlaylist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    url: str
    content: Optional[str] = None
    player_api: Optional[str] = None
    tenant_id: str
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_refresh: Optional[datetime] = None
    # Player API data
    max_connections: Optional[int] = None
    active_connections: Optional[int] = None
    expiration_date: Optional[str] = None
    api_last_checked: Optional[datetime] = None

class M3UPlaylistCreate(BaseModel):
    name: str
    url: str
    content: Optional[str] = None
    player_api: Optional[str] = None

class M3UPlaylistUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None
    player_api: Optional[str] = None

class Channel(BaseModel):
    name: str
    url: str
    group: Optional[str] = None
    logo: Optional[str] = None
    playlist_name: str
    playlist_id: str

class StreamProbeResult(BaseModel):
    url: str
    online: bool
    response_time: Optional[float] = None
    error: Optional[str] = None
    bitrate: Optional[str] = None
    resolution: Optional[str] = None
    audio_codec: Optional[str] = None
    video_codec: Optional[str] = None
    stream_type: Optional[str] = None
    variants: Optional[List[dict]] = None

class FFmpegProbeResult(BaseModel):
    url: str
    online: bool
    status: str
    format: Optional[str] = None
    duration: Optional[str] = None
    bitrate: Optional[str] = None
    video_codec: Optional[str] = None
    video_resolution: Optional[str] = None
    video_fps: Optional[str] = None
    audio_codec: Optional[str] = None
    audio_sample_rate: Optional[str] = None
    audio_channels: Optional[str] = None
    error: Optional[str] = None
    raw_data: Optional[dict] = None

class MonitoredCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    category: str
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MonitoredCategoryCreate(BaseModel):
    category: str

class ThemeUpdate(BaseModel):
    theme: str

class BackupSchedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    schedule_type: str  # "full" or "tenant"
    tenant_id: Optional[str] = None
    frequency: str  # "daily" or "weekly"
    retention_days: int
    enabled: bool = True
    last_run: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BackupScheduleCreate(BaseModel):
    schedule_type: str
    tenant_id: Optional[str] = None
    frequency: str
    retention_days: int

class BackupScheduleUpdate(BaseModel):
    frequency: Optional[str] = None
    retention_days: Optional[int] = None
    enabled: Optional[bool] = None

class SystemSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    production_repo_url: str = ""
    beta_repo_url: str = ""
    current_branch: str = "production"
    last_update: Optional[datetime] = None
    updated_by: Optional[str] = None

class SystemSettingsUpdate(BaseModel):
    production_repo_url: Optional[str] = None
    beta_repo_url: Optional[str] = None

# Backup directory setup
BACKUP_DIR = ROOT_DIR / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**user_doc)
    
    # Check tenant expiration (skip for super_admin)
    if user.role != "super_admin" and user.tenant_id:
        tenant = await db.tenants.find_one({"id": user.tenant_id}, {"_id": 0})
        if tenant:
            expiration = tenant.get('expiration_date')
            if expiration:
                if isinstance(expiration, str):
                    expiration = datetime.fromisoformat(expiration)
                if expiration.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                    raise HTTPException(status_code=403, detail="Tenant subscription has expired. Please contact your administrator.")
    
    return user

# Auth routes
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        role=user_data.role,
        tenant_id=user_data.tenant_id
    )
    
    user_doc = user.model_dump()
    user_doc['password'] = hashed_password
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    user_doc = await db.users.find_one({"username": login_data.username}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(login_data.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password'})
    access_token = create_access_token(data={"sub": user.id})
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Tenant routes
@api_router.post("/tenants", response_model=Tenant)
async def create_tenant(tenant_data: TenantCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can create tenants")
    
    # Check if owner username exists
    existing_owner = await db.users.find_one({"username": tenant_data.owner_username})
    if existing_owner:
        raise HTTPException(status_code=400, detail="Owner username already exists")
    
    # Parse expiration date if provided
    expiration_date = datetime(2025, 12, 1, tzinfo=timezone.utc)
    if tenant_data.expiration_date:
        try:
            from dateutil import parser
            expiration_date = parser.parse(tenant_data.expiration_date).replace(tzinfo=timezone.utc)
        except:
            # If parsing fails, try simple format
            try:
                expiration_date = datetime.strptime(tenant_data.expiration_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Create tenant
    tenant = Tenant(
        name=tenant_data.name,
        owner_id="",  # Will be set after owner is created
        expiration_date=expiration_date,
        created_by=current_user.id
    )
    
    tenant_doc = tenant.model_dump()
    tenant_doc['created_at'] = tenant_doc['created_at'].isoformat()
    tenant_doc['expiration_date'] = tenant_doc['expiration_date'].isoformat()
    
    # Create tenant owner
    hashed_password = get_password_hash(tenant_data.owner_password)
    owner = User(
        username=tenant_data.owner_username,
        role="tenant_owner",
        tenant_id=tenant.id
    )
    
    owner_doc = owner.model_dump()
    owner_doc['password'] = hashed_password
    owner_doc['created_at'] = owner_doc['created_at'].isoformat()
    
    # Update tenant with owner_id
    tenant_doc['owner_id'] = owner.id
    
    await db.tenants.insert_one(tenant_doc)
    await db.users.insert_one(owner_doc)
    
    tenant_doc['created_at'] = datetime.fromisoformat(tenant_doc['created_at'])
    tenant_doc['expiration_date'] = datetime.fromisoformat(tenant_doc['expiration_date'])
    return Tenant(**tenant_doc)

@api_router.get("/tenants", response_model=List[Tenant])
async def get_tenants(current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can view all tenants")
    
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(1000)
    for tenant in tenants:
        if tenant.get('created_at') and isinstance(tenant['created_at'], str):
            tenant['created_at'] = datetime.fromisoformat(tenant['created_at'])
        if tenant.get('expiration_date') and isinstance(tenant['expiration_date'], str):
            tenant['expiration_date'] = datetime.fromisoformat(tenant['expiration_date'])
    return tenants

@api_router.put("/tenants/{tenant_id}", response_model=Tenant)
async def update_tenant(tenant_id: str, tenant_data: TenantUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can update tenants")
    
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_fields = {}
    if tenant_data.name:
        update_fields['name'] = tenant_data.name
    
    if tenant_data.expiration_date:
        try:
            expiration_date = datetime.strptime(tenant_data.expiration_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            update_fields['expiration_date'] = expiration_date.isoformat()
        except:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    if update_fields:
        await db.tenants.update_one({"id": tenant_id}, {"$set": update_fields})
    
    updated_tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if updated_tenant.get('created_at') and isinstance(updated_tenant['created_at'], str):
        updated_tenant['created_at'] = datetime.fromisoformat(updated_tenant['created_at'])
    if updated_tenant.get('expiration_date') and isinstance(updated_tenant['expiration_date'], str):
        updated_tenant['expiration_date'] = datetime.fromisoformat(updated_tenant['expiration_date'])
    
    return Tenant(**updated_tenant)

@api_router.get("/tenants/{tenant_id}", response_model=Tenant)
async def get_tenant(tenant_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin" and current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    tenant_doc = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant_doc:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    if isinstance(tenant_doc['created_at'], str):
        tenant_doc['created_at'] = datetime.fromisoformat(tenant_doc['created_at'])
    
    return Tenant(**tenant_doc)

# User management routes
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "tenant_owner"]:
        raise HTTPException(status_code=403, detail="Only admins and tenant owners can create users")
    
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Tenant owners can only create users in their tenant
    if current_user.role == "tenant_owner":
        if user_data.tenant_id and user_data.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="Can only create users in your tenant")
        user_data.tenant_id = current_user.tenant_id
        user_data.role = "user"  # Tenant owners can only create regular users
    
    # Super admins can create users for any tenant
    if current_user.role == "super_admin":
        # Validate tenant_id if provided
        if user_data.tenant_id:
            tenant = await db.tenants.find_one({"id": user_data.tenant_id})
            if not tenant:
                raise HTTPException(status_code=404, detail="Tenant not found")
    
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        name=user_data.name,
        role=user_data.role if current_user.role == "super_admin" else "user",
        tenant_id=user_data.tenant_id
    )
    
    user_doc = user.model_dump()
    user_doc['password'] = hashed_password
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    
    return user

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user), tenant_id: Optional[str] = None):
    if current_user.role == "user":
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if current_user.role == "tenant_owner":
        query = {"tenant_id": current_user.tenant_id}
    elif current_user.role == "super_admin" and tenant_id:
        # Allow filtering by tenant_id for super admins
        query = {"tenant_id": tenant_id}
    
    users = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
    
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return users

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "tenant_owner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Tenant owners can only delete users in their tenant
    if current_user.role == "tenant_owner" and user_doc['tenant_id'] != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Can only delete users in your tenant")
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted successfully"}

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_data: UserUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "tenant_owner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Tenant owners can only update users in their tenant
    if current_user.role == "tenant_owner" and user_doc['tenant_id'] != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Can only update users in your tenant")
    
    # Build update data
    update_data = {}
    if user_data.name is not None:
        update_data['name'] = user_data.name
    if user_data.password is not None:
        update_data['password'] = get_password_hash(user_data.password)
    if user_data.profile_image is not None:
        update_data['profile_image'] = user_data.profile_image
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Fetch updated user
    updated_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if isinstance(updated_doc['created_at'], str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    
    return User(**updated_doc)

# M3U Playlist routes
@api_router.post("/m3u", response_model=M3UPlaylist)
async def create_m3u(playlist_data: M3UPlaylistCreate, current_user: User = Depends(get_current_user)):
    if current_user.role == "user":
        raise HTTPException(status_code=403, detail="Only admins and tenant owners can create playlists")
    
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    
    playlist = M3UPlaylist(
        name=playlist_data.name,
        url=playlist_data.url,
        content=playlist_data.content,
        player_api=playlist_data.player_api,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id
    )
    
    playlist_doc = playlist.model_dump()
    playlist_doc['created_at'] = playlist_doc['created_at'].isoformat()
    playlist_doc['updated_at'] = playlist_doc['updated_at'].isoformat()
    
    # Fetch player API data if URL provided
    if playlist_data.player_api:
        api_data = await fetch_player_api_data(playlist_data.player_api)
        playlist_doc['max_connections'] = api_data.get('max_connections')
        playlist_doc['active_connections'] = api_data.get('active_connections')
        playlist_doc['expiration_date'] = api_data.get('expiration_date')
        playlist_doc['api_last_checked'] = datetime.now(timezone.utc).isoformat()
    
    await db.m3u_playlists.insert_one(playlist_doc)
    
    # Return the updated playlist with API data
    updated_doc = await db.m3u_playlists.find_one({"id": playlist.id}, {"_id": 0})
    
    if isinstance(updated_doc['created_at'], str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    if isinstance(updated_doc['updated_at'], str):
        updated_doc['updated_at'] = datetime.fromisoformat(updated_doc['updated_at'])
    if updated_doc.get('api_last_checked') and isinstance(updated_doc['api_last_checked'], str):
        updated_doc['api_last_checked'] = datetime.fromisoformat(updated_doc['api_last_checked'])
    
    return M3UPlaylist(**updated_doc)

@api_router.get("/m3u", response_model=List[M3UPlaylist])
async def get_m3u_playlists(current_user: User = Depends(get_current_user)):
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    
    playlists = await db.m3u_playlists.find({"tenant_id": current_user.tenant_id}, {"_id": 0}).to_list(1000)
    
    for playlist in playlists:
        if isinstance(playlist['created_at'], str):
            playlist['created_at'] = datetime.fromisoformat(playlist['created_at'])
        if isinstance(playlist['updated_at'], str):
            playlist['updated_at'] = datetime.fromisoformat(playlist['updated_at'])
        if playlist.get('last_refresh') and isinstance(playlist['last_refresh'], str):
            playlist['last_refresh'] = datetime.fromisoformat(playlist['last_refresh'])
        if playlist.get('api_last_checked') and isinstance(playlist['api_last_checked'], str):
            playlist['api_last_checked'] = datetime.fromisoformat(playlist['api_last_checked'])
    
    return playlists

@api_router.put("/m3u/{playlist_id}", response_model=M3UPlaylist)
async def update_m3u(playlist_id: str, playlist_data: M3UPlaylistUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role == "user":
        raise HTTPException(status_code=403, detail="Only admins and tenant owners can update playlists")
    
    playlist_doc = await db.m3u_playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist_doc:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if playlist_doc['tenant_id'] != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Can only update playlists in your tenant")
    
    update_data = {k: v for k, v in playlist_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.m3u_playlists.update_one({"id": playlist_id}, {"$set": update_data})
    
    updated_doc = await db.m3u_playlists.find_one({"id": playlist_id}, {"_id": 0})
    
    if isinstance(updated_doc['created_at'], str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    if isinstance(updated_doc['updated_at'], str):
        updated_doc['updated_at'] = datetime.fromisoformat(updated_doc['updated_at'])
    if updated_doc.get('last_refresh') and isinstance(updated_doc['last_refresh'], str):
        updated_doc['last_refresh'] = datetime.fromisoformat(updated_doc['last_refresh'])
    
    return M3UPlaylist(**updated_doc)

@api_router.delete("/m3u/{playlist_id}")
async def delete_m3u(playlist_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role == "user":
        raise HTTPException(status_code=403, detail="Only admins and tenant owners can delete playlists")
    
    playlist_doc = await db.m3u_playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist_doc:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if playlist_doc['tenant_id'] != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Can only delete playlists in your tenant")
    
    await db.m3u_playlists.delete_one({"id": playlist_id})
    return {"message": "Playlist deleted successfully"}

@api_router.post("/m3u/refresh")
async def trigger_refresh(current_user: User = Depends(get_current_user)):
    """Manually trigger M3U playlist refresh"""
    if current_user.role not in ["super_admin", "tenant_owner"]:
        raise HTTPException(status_code=403, detail="Only admins and tenant owners can refresh playlists")
    
    asyncio.create_task(refresh_m3u_playlists())
    return {"message": "Playlist refresh triggered"}

@api_router.get("/m3u/refresh/status")
async def get_refresh_status(current_user: User = Depends(get_current_user)):
    """Get the status of the refresh job"""
    job = scheduler.get_job('refresh_m3u_playlists')
    if job:
        return {
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "interval": "1 hour"
        }
    return {"message": "Refresh job not scheduled"}

@api_router.get("/channels/search", response_model=List[Channel])
async def search_channels(q: str, current_user: User = Depends(get_current_user)):
    """Search for channels across all playlists in user's tenant"""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    
    # Get all playlists for the tenant
    playlists = await db.m3u_playlists.find({"tenant_id": current_user.tenant_id}, {"_id": 0}).to_list(1000)
    
    all_channels = []
    search_query = q.lower()
    
    for playlist in playlists:
        if playlist.get('content'):
            channels = parse_m3u_content(playlist['content'])
            
            # Filter channels by search query
            for channel in channels:
                if search_query in channel.get('name', '').lower():
                    all_channels.append(Channel(
                        name=channel.get('name', 'Unknown'),
                        url=channel.get('url', ''),
                        group=channel.get('group'),
                        logo=channel.get('logo'),
                        playlist_name=playlist['name'],
                        playlist_id=playlist['id']
                    ))
    
    return all_channels[:100]  # Limit to 100 results

@api_router.post("/channels/probe", response_model=StreamProbeResult)
async def probe_channel(url: str, current_user: User = Depends(get_current_user)):
    """Probe a stream URL to check if it's online"""
    result = await probe_stream(url)
    return StreamProbeResult(**result)

@api_router.post("/channels/probe-ffmpeg", response_model=FFmpegProbeResult)
async def probe_channel_ffmpeg(url: str, current_user: User = Depends(get_current_user)):
    """Probe a stream URL using FFmpeg/ffprobe for detailed information"""
    result = await probe_stream_ffmpeg(url)
    return FFmpegProbeResult(**result)

@api_router.get("/categories")
async def get_categories(current_user: User = Depends(get_current_user)):
    """Get all unique categories from playlists in user's tenant with source information"""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    
    # Get all playlists for the tenant
    playlists = await db.m3u_playlists.find({"tenant_id": current_user.tenant_id}, {"_id": 0}).to_list(1000)
    
    # Use dict to track categories with their sources
    categories_map = {}
    
    for playlist in playlists:
        playlist_name = playlist.get('name', 'Unknown Source')
        if playlist.get('content'):
            channels = parse_m3u_content(playlist['content'])
            
            for channel in channels:
                category = channel.get('group')
                if category:
                    # Create unique key for each category-source combination
                    key = f"{category}|{playlist_name}"
                    if key not in categories_map:
                        categories_map[key] = {
                            "name": category,
                            "playlist_name": playlist_name
                        }
    
    # Convert to list and sort by category name
    result = list(categories_map.values())
    result.sort(key=lambda x: x['name'])
    
    return result

@api_router.post("/categories/monitor", response_model=MonitoredCategory)
async def add_monitored_category(category_data: MonitoredCategoryCreate, current_user: User = Depends(get_current_user)):
    """Add a category to monitor"""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    
    # Check if already monitoring
    existing = await db.monitored_categories.find_one({
        "tenant_id": current_user.tenant_id,
        "category": category_data.category
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Category already monitored")
    
    monitored = MonitoredCategory(
        tenant_id=current_user.tenant_id,
        category=category_data.category,
        created_by=current_user.id
    )
    
    monitored_doc = monitored.model_dump()
    monitored_doc['created_at'] = monitored_doc['created_at'].isoformat()
    
    await db.monitored_categories.insert_one(monitored_doc)
    
    return monitored

@api_router.get("/categories/monitor", response_model=List[MonitoredCategory])
async def get_monitored_categories(current_user: User = Depends(get_current_user)):
    """Get all monitored categories for user's tenant"""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    
    categories = await db.monitored_categories.find(
        {"tenant_id": current_user.tenant_id},
        {"_id": 0}
    ).to_list(1000)
    
    for cat in categories:
        if isinstance(cat['created_at'], str):
            cat['created_at'] = datetime.fromisoformat(cat['created_at'])
    
    return categories

@api_router.delete("/categories/monitor/{category_id}")
async def remove_monitored_category(category_id: str, current_user: User = Depends(get_current_user)):
    """Remove a monitored category"""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    
    result = await db.monitored_categories.delete_one({
        "id": category_id,
        "tenant_id": current_user.tenant_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"message": "Category removed from monitoring"}

@api_router.get("/events/channels")
async def get_monitored_channels(current_user: User = Depends(get_current_user)):
    """Get all channels from monitored categories"""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    
    # Get monitored categories
    monitored = await db.monitored_categories.find(
        {"tenant_id": current_user.tenant_id},
        {"_id": 0}
    ).to_list(1000)
    
    monitored_categories = [m['category'] for m in monitored]
    
    if not monitored_categories:
        return []
    
    # Get all playlists for the tenant
    playlists = await db.m3u_playlists.find({"tenant_id": current_user.tenant_id}, {"_id": 0}).to_list(1000)
    
    all_channels = []
    
    for playlist in playlists:
        if playlist.get('content'):
            channels = parse_m3u_content(playlist['content'])
            
            for channel in channels:
                if channel.get('group') in monitored_categories:
                    all_channels.append(Channel(
                        name=channel.get('name', 'Unknown'),
                        url=channel.get('url', ''),
                        group=channel.get('group'),
                        logo=channel.get('logo'),
                        playlist_name=playlist['name'],
                        playlist_id=playlist['id']
                    ))
    
    return all_channels

@api_router.post("/m3u/{playlist_id}/refresh-api")
async def refresh_player_api(playlist_id: str, current_user: User = Depends(get_current_user)):
    """Refresh player API data for a playlist"""
    if current_user.role == "user":
        raise HTTPException(status_code=403, detail="Only admins and tenant owners can refresh API data")
    
    playlist_doc = await db.m3u_playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist_doc:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    if playlist_doc['tenant_id'] != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Can only refresh playlists in your tenant")
    
    if not playlist_doc.get('player_api'):
        raise HTTPException(status_code=400, detail="Playlist has no player API URL")
    
    # Fetch fresh data
    api_data = await fetch_player_api_data(playlist_doc['player_api'])
    
    update_data = {
        'max_connections': api_data.get('max_connections'),
        'active_connections': api_data.get('active_connections'),
        'expiration_date': api_data.get('expiration_date'),
        'api_last_checked': datetime.now(timezone.utc).isoformat()
    }
    
    await db.m3u_playlists.update_one({"id": playlist_id}, {"$set": update_data})
    
    return {
        "message": "Player API data refreshed",
        "data": api_data
    }

# Profile routes
@api_router.put("/profile/theme")
async def update_theme(theme_data: ThemeUpdate, current_user: User = Depends(get_current_user)):
    if theme_data.theme not in ["light", "dark"]:
        raise HTTPException(status_code=400, detail="Theme must be 'light' or 'dark'")
    
    await db.users.update_one({"id": current_user.id}, {"$set": {"theme": theme_data.theme}})
    return {"message": "Theme updated successfully"}

@api_router.put("/profile/update", response_model=User)
async def update_profile(user_data: UserUpdate, current_user: User = Depends(get_current_user)):
    """Update current user's profile"""
    update_data = {}
    
    if user_data.name is not None:
        update_data['name'] = user_data.name
    if user_data.password is not None:
        update_data['password'] = get_password_hash(user_data.password)
    if user_data.profile_image is not None:
        # Validate it's a PNG (check base64 header)
        if user_data.profile_image and not user_data.profile_image.startswith('data:image/png;base64,'):
            raise HTTPException(status_code=400, detail="Profile image must be PNG format")
        
        # Check size (approximately - base64 is ~33% larger than binary)
        # 2MB * 1.33 = ~2.66MB base64
        if len(user_data.profile_image) > 2800000:
            raise HTTPException(status_code=400, detail="Profile image must be less than 2MB")
        
        update_data['profile_image'] = user_data.profile_image
    
    if update_data:
        await db.users.update_one({"id": current_user.id}, {"$set": update_data})
    
    # Fetch updated user
    updated_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0, "password": 0})
    if isinstance(updated_doc['created_at'], str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    
    return User(**updated_doc)

# Backup and Restore routes (Super Admin only)
@api_router.get("/backup/full")
async def backup_full_database(current_user: User = Depends(get_current_user)):
    """Backup entire database (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can backup the full database")
    
    try:
        backup_data = {
            "backup_date": datetime.now(timezone.utc).isoformat(),
            "backup_type": "full",
            "collections": {}
        }
        
        # Backup all collections
        collections = ["users", "tenants", "m3u_playlists", "monitored_categories"]
        
        for collection_name in collections:
            collection = db[collection_name]
            docs = await collection.find({}, {"_id": 0}).to_list(10000)
            
            # Convert datetime objects to ISO strings
            for doc in docs:
                for key, value in doc.items():
                    if isinstance(value, datetime):
                        doc[key] = value.isoformat()
            
            backup_data["collections"][collection_name] = docs
        
        return backup_data
    except Exception as e:
        logger.error(f"Error creating full backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")

@api_router.get("/backup/tenant/{tenant_id}")
async def backup_tenant(tenant_id: str, current_user: User = Depends(get_current_user)):
    """Backup specific tenant data (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can backup tenant data")
    
    try:
        # Verify tenant exists
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        backup_data = {
            "backup_date": datetime.now(timezone.utc).isoformat(),
            "backup_type": "tenant",
            "tenant_id": tenant_id,
            "tenant_name": tenant.get("name"),
            "data": {}
        }
        
        # Backup tenant info
        if tenant.get('created_at') and isinstance(tenant['created_at'], datetime):
            tenant['created_at'] = tenant['created_at'].isoformat()
        backup_data["data"]["tenant"] = tenant
        
        # Backup users in this tenant
        users = await db.users.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
        for user in users:
            if user.get('created_at') and isinstance(user['created_at'], datetime):
                user['created_at'] = user['created_at'].isoformat()
        backup_data["data"]["users"] = users
        
        # Backup M3U playlists for this tenant
        playlists = await db.m3u_playlists.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
        for playlist in playlists:
            for date_field in ['created_at', 'updated_at', 'last_refresh', 'api_last_checked']:
                if playlist.get(date_field) and isinstance(playlist[date_field], datetime):
                    playlist[date_field] = playlist[date_field].isoformat()
        backup_data["data"]["m3u_playlists"] = playlists
        
        # Backup monitored categories for this tenant
        categories = await db.monitored_categories.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
        for category in categories:
            if category.get('created_at') and isinstance(category['created_at'], datetime):
                category['created_at'] = category['created_at'].isoformat()
        backup_data["data"]["monitored_categories"] = categories
        
        return backup_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating tenant backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")

@api_router.post("/restore/full")
async def restore_full_database(backup_data: dict, current_user: User = Depends(get_current_user)):
    """Restore entire database from backup (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can restore the full database")
    
    try:
        if backup_data.get("backup_type") != "full":
            raise HTTPException(status_code=400, detail="Invalid backup type for full restore")
        
        collections_data = backup_data.get("collections", {})
        if not collections_data:
            raise HTTPException(status_code=400, detail="No collection data found in backup")
        
        # Restore each collection
        restored_counts = {}
        for collection_name, docs in collections_data.items():
            if not docs:
                continue
            
            collection = db[collection_name]
            
            # Clear existing data
            await collection.delete_many({})
            
            # Convert ISO strings back to datetime objects
            for doc in docs:
                for key, value in doc.items():
                    if isinstance(value, str) and ('_at' in key or key == 'last_refresh'):
                        try:
                            doc[key] = datetime.fromisoformat(value)
                        except:
                            pass
            
            # Insert backup data
            if docs:
                await collection.insert_many(docs)
            restored_counts[collection_name] = len(docs)
        
        return {
            "message": "Full database restored successfully",
            "restored_counts": restored_counts,
            "backup_date": backup_data.get("backup_date")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring full backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

@api_router.post("/restore/tenant")
async def restore_tenant(backup_data: dict, current_user: User = Depends(get_current_user)):
    """Restore tenant data from backup (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can restore tenant data")
    
    try:
        if backup_data.get("backup_type") != "tenant":
            raise HTTPException(status_code=400, detail="Invalid backup type for tenant restore")
        
        tenant_id = backup_data.get("tenant_id")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="No tenant ID found in backup")
        
        tenant_data = backup_data.get("data", {})
        if not tenant_data:
            raise HTTPException(status_code=400, detail="No tenant data found in backup")
        
        # Delete existing tenant data
        await db.tenants.delete_many({"id": tenant_id})
        await db.users.delete_many({"tenant_id": tenant_id})
        await db.m3u_playlists.delete_many({"tenant_id": tenant_id})
        await db.monitored_categories.delete_many({"tenant_id": tenant_id})
        
        restored_counts = {}
        
        # Restore tenant
        if tenant_data.get("tenant"):
            tenant = tenant_data["tenant"]
            if tenant.get('created_at') and isinstance(tenant['created_at'], str):
                tenant['created_at'] = datetime.fromisoformat(tenant['created_at'])
            await db.tenants.insert_one(tenant)
            restored_counts["tenant"] = 1
        
        # Restore users
        if tenant_data.get("users"):
            users = tenant_data["users"]
            for user in users:
                if user.get('created_at') and isinstance(user['created_at'], str):
                    user['created_at'] = datetime.fromisoformat(user['created_at'])
            await db.users.insert_many(users)
            restored_counts["users"] = len(users)
        
        # Restore M3U playlists
        if tenant_data.get("m3u_playlists"):
            playlists = tenant_data["m3u_playlists"]
            for playlist in playlists:
                for date_field in ['created_at', 'updated_at', 'last_refresh', 'api_last_checked']:
                    if playlist.get(date_field) and isinstance(playlist[date_field], str):
                        try:
                            playlist[date_field] = datetime.fromisoformat(playlist[date_field])
                        except:
                            pass
            await db.m3u_playlists.insert_many(playlists)
            restored_counts["m3u_playlists"] = len(playlists)
        
        # Restore monitored categories
        if tenant_data.get("monitored_categories"):
            categories = tenant_data["monitored_categories"]
            for category in categories:
                if category.get('created_at') and isinstance(category['created_at'], str):
                    category['created_at'] = datetime.fromisoformat(category['created_at'])
            await db.monitored_categories.insert_many(categories)
            restored_counts["monitored_categories"] = len(categories)
        
        return {
            "message": f"Tenant '{tenant_data.get('tenant', {}).get('name')}' restored successfully",
            "restored_counts": restored_counts,
            "backup_date": backup_data.get("backup_date")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring tenant backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

# Scheduled Backup Management
async def perform_scheduled_backup(schedule_id: str):
    """Execute a scheduled backup"""
    try:
        schedule = await db.backup_schedules.find_one({"id": schedule_id}, {"_id": 0})
        if not schedule or not schedule.get('enabled'):
            return
        
        backup_data = {}
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        
        if schedule['schedule_type'] == 'full':
            # Full database backup
            backup_data = {
                "backup_date": datetime.now(timezone.utc).isoformat(),
                "backup_type": "full",
                "schedule_id": schedule_id,
                "collections": {}
            }
            
            collections = ["users", "tenants", "m3u_playlists", "monitored_categories"]
            for collection_name in collections:
                collection = db[collection_name]
                docs = await collection.find({}, {"_id": 0}).to_list(10000)
                for doc in docs:
                    for key, value in doc.items():
                        if isinstance(value, datetime):
                            doc[key] = value.isoformat()
                backup_data["collections"][collection_name] = docs
            
            filename = f"full_backup_{timestamp}.json"
        else:
            # Tenant backup
            tenant_id = schedule['tenant_id']
            tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
            if not tenant:
                logger.error(f"Tenant {tenant_id} not found for scheduled backup")
                return
            
            backup_data = {
                "backup_date": datetime.now(timezone.utc).isoformat(),
                "backup_type": "tenant",
                "schedule_id": schedule_id,
                "tenant_id": tenant_id,
                "tenant_name": tenant.get("name"),
                "data": {}
            }
            
            if tenant.get('created_at') and isinstance(tenant['created_at'], datetime):
                tenant['created_at'] = tenant['created_at'].isoformat()
            backup_data["data"]["tenant"] = tenant
            
            users = await db.users.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
            for user in users:
                if user.get('created_at') and isinstance(user['created_at'], datetime):
                    user['created_at'] = user['created_at'].isoformat()
            backup_data["data"]["users"] = users
            
            playlists = await db.m3u_playlists.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
            for playlist in playlists:
                for date_field in ['created_at', 'updated_at', 'last_refresh', 'api_last_checked']:
                    if playlist.get(date_field) and isinstance(playlist[date_field], datetime):
                        playlist[date_field] = playlist[date_field].isoformat()
            backup_data["data"]["m3u_playlists"] = playlists
            
            categories = await db.monitored_categories.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
            for category in categories:
                if category.get('created_at') and isinstance(category['created_at'], datetime):
                    category['created_at'] = category['created_at'].isoformat()
            backup_data["data"]["monitored_categories"] = categories
            
            filename = f"tenant_{tenant.get('name', tenant_id)}_{timestamp}.json"
        
        # Save backup to file
        backup_file = BACKUP_DIR / filename
        with open(backup_file, 'w') as f:
            json.dump(backup_data, f, indent=2)
        
        # Update last run time
        await db.backup_schedules.update_one(
            {"id": schedule_id},
            {"$set": {"last_run": datetime.now(timezone.utc)}}
        )
        
        # Clean up old backups based on retention policy
        await cleanup_old_backups(schedule_id, schedule['retention_days'])
        
        logger.info(f"Scheduled backup completed: {filename}")
        
    except Exception as e:
        logger.error(f"Error in scheduled backup {schedule_id}: {str(e)}")

async def cleanup_old_backups(schedule_id: str, retention_days: int):
    """Remove backup files older than retention period"""
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
        
        for backup_file in BACKUP_DIR.glob("*.json"):
            if backup_file.stat().st_mtime < cutoff_date.timestamp():
                # Check if file belongs to this schedule (read and verify)
                try:
                    with open(backup_file, 'r') as f:
                        data = json.load(f)
                        if data.get('schedule_id') == schedule_id:
                            backup_file.unlink()
                            logger.info(f"Deleted old backup: {backup_file.name}")
                except:
                    pass
    except Exception as e:
        logger.error(f"Error cleaning up old backups: {str(e)}")

@api_router.get("/backup/schedules", response_model=List[BackupSchedule])
async def get_backup_schedules(current_user: User = Depends(get_current_user)):
    """Get all backup schedules (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can view backup schedules")
    
    schedules = await db.backup_schedules.find({}, {"_id": 0}).to_list(100)
    for schedule in schedules:
        if schedule.get('created_at') and isinstance(schedule['created_at'], str):
            schedule['created_at'] = datetime.fromisoformat(schedule['created_at'])
        if schedule.get('last_run') and isinstance(schedule['last_run'], str):
            schedule['last_run'] = datetime.fromisoformat(schedule['last_run'])
    
    return schedules

@api_router.post("/backup/schedules", response_model=BackupSchedule)
async def create_backup_schedule(schedule_data: BackupScheduleCreate, current_user: User = Depends(get_current_user)):
    """Create a new backup schedule (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can create backup schedules")
    
    if schedule_data.schedule_type not in ["full", "tenant"]:
        raise HTTPException(status_code=400, detail="Schedule type must be 'full' or 'tenant'")
    
    if schedule_data.schedule_type == "tenant" and not schedule_data.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID required for tenant backup schedule")
    
    if schedule_data.frequency not in ["daily", "weekly"]:
        raise HTTPException(status_code=400, detail="Frequency must be 'daily' or 'weekly'")
    
    if schedule_data.retention_days < 1:
        raise HTTPException(status_code=400, detail="Retention days must be at least 1")
    
    schedule = BackupSchedule(
        schedule_type=schedule_data.schedule_type,
        tenant_id=schedule_data.tenant_id,
        frequency=schedule_data.frequency,
        retention_days=schedule_data.retention_days,
        created_by=current_user.id
    )
    
    schedule_doc = schedule.model_dump()
    schedule_doc['created_at'] = schedule_doc['created_at'].isoformat()
    
    await db.backup_schedules.insert_one(schedule_doc)
    
    # Add job to scheduler
    if schedule.frequency == "daily":
        scheduler.add_job(
            perform_scheduled_backup,
            'cron',
            hour=2,  # Run at 2 AM
            args=[schedule.id],
            id=f"backup_{schedule.id}",
            replace_existing=True
        )
    else:  # weekly
        scheduler.add_job(
            perform_scheduled_backup,
            'cron',
            day_of_week='sun',
            hour=2,  # Run at 2 AM on Sundays
            args=[schedule.id],
            id=f"backup_{schedule.id}",
            replace_existing=True
        )
    
    logger.info(f"Created backup schedule: {schedule.id}")
    return schedule

@api_router.put("/backup/schedules/{schedule_id}", response_model=BackupSchedule)
async def update_backup_schedule(schedule_id: str, update_data: BackupScheduleUpdate, current_user: User = Depends(get_current_user)):
    """Update a backup schedule (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can update backup schedules")
    
    schedule = await db.backup_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Backup schedule not found")
    
    update_fields = {}
    if update_data.frequency is not None:
        if update_data.frequency not in ["daily", "weekly"]:
            raise HTTPException(status_code=400, detail="Frequency must be 'daily' or 'weekly'")
        update_fields['frequency'] = update_data.frequency
    
    if update_data.retention_days is not None:
        if update_data.retention_days < 1:
            raise HTTPException(status_code=400, detail="Retention days must be at least 1")
        update_fields['retention_days'] = update_data.retention_days
    
    if update_data.enabled is not None:
        update_fields['enabled'] = update_data.enabled
    
    if update_fields:
        await db.backup_schedules.update_one({"id": schedule_id}, {"$set": update_fields})
        
        # Update scheduler job
        if 'frequency' in update_fields or 'enabled' in update_fields:
            try:
                scheduler.remove_job(f"backup_{schedule_id}")
            except:
                pass
            
            if update_fields.get('enabled', schedule['enabled']):
                frequency = update_fields.get('frequency', schedule['frequency'])
                if frequency == "daily":
                    scheduler.add_job(
                        perform_scheduled_backup,
                        'cron',
                        hour=2,
                        args=[schedule_id],
                        id=f"backup_{schedule_id}",
                        replace_existing=True
                    )
                else:
                    scheduler.add_job(
                        perform_scheduled_backup,
                        'cron',
                        day_of_week='sun',
                        hour=2,
                        args=[schedule_id],
                        id=f"backup_{schedule_id}",
                        replace_existing=True
                    )
    
    updated_schedule = await db.backup_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if updated_schedule.get('created_at') and isinstance(updated_schedule['created_at'], str):
        updated_schedule['created_at'] = datetime.fromisoformat(updated_schedule['created_at'])
    if updated_schedule.get('last_run') and isinstance(updated_schedule['last_run'], str):
        updated_schedule['last_run'] = datetime.fromisoformat(updated_schedule['last_run'])
    
    return BackupSchedule(**updated_schedule)

@api_router.delete("/backup/schedules/{schedule_id}")
async def delete_backup_schedule(schedule_id: str, current_user: User = Depends(get_current_user)):
    """Delete a backup schedule (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can delete backup schedules")
    
    schedule = await db.backup_schedules.find_one({"id": schedule_id})
    if not schedule:
        raise HTTPException(status_code=404, detail="Backup schedule not found")
    
    # Remove from scheduler
    try:
        scheduler.remove_job(f"backup_{schedule_id}")
    except:
        pass
    
    await db.backup_schedules.delete_one({"id": schedule_id})
    
    return {"message": "Backup schedule deleted successfully"}

@api_router.get("/backup/files")
async def list_backup_files(current_user: User = Depends(get_current_user)):
    """List all backup files (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can list backup files")
    
    files = []
    for backup_file in BACKUP_DIR.glob("*.json"):
        stat = backup_file.stat()
        files.append({
            "filename": backup_file.name,
            "size": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
        })
    
    return sorted(files, key=lambda x: x['created_at'], reverse=True)

@api_router.get("/backup/files/{filename}")
async def download_backup_file(filename: str, current_user: User = Depends(get_current_user)):
    """Download a backup file (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can download backup files")
    
    backup_file = BACKUP_DIR / filename
    if not backup_file.exists() or not backup_file.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")
    
    with open(backup_file, 'r') as f:
        return json.load(f)

# System Settings and Updates
@api_router.get("/system/settings", response_model=SystemSettings)
async def get_system_settings(current_user: User = Depends(get_current_user)):
    """Get system settings (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can view system settings")
    
    settings = await db.system_settings.find_one({}, {"_id": 0})
    if not settings:
        # Create default settings
        settings = SystemSettings()
        settings_doc = settings.model_dump()
        await db.system_settings.insert_one(settings_doc)
    else:
        if settings.get('last_update') and isinstance(settings['last_update'], str):
            settings['last_update'] = datetime.fromisoformat(settings['last_update'])
        settings = SystemSettings(**settings)
    
    return settings

@api_router.put("/system/settings", response_model=SystemSettings)
async def update_system_settings(settings_data: SystemSettingsUpdate, current_user: User = Depends(get_current_user)):
    """Update system settings (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can update system settings")
    
    update_fields = {}
    if settings_data.production_repo_url is not None:
        update_fields['production_repo_url'] = settings_data.production_repo_url
    if settings_data.beta_repo_url is not None:
        update_fields['beta_repo_url'] = settings_data.beta_repo_url
    
    if update_fields:
        update_fields['updated_by'] = current_user.id
        await db.system_settings.update_one({}, {"$set": update_fields}, upsert=True)
    
    settings = await db.system_settings.find_one({}, {"_id": 0})
    if settings.get('last_update') and isinstance(settings['last_update'], str):
        settings['last_update'] = datetime.fromisoformat(settings['last_update'])
    
    return SystemSettings(**settings)

@api_router.post("/system/update")
async def pull_system_update(branch: str, current_user: User = Depends(get_current_user)):
    """Pull updates from GitHub repository (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can update the system")
    
    if branch not in ["production", "beta"]:
        raise HTTPException(status_code=400, detail="Branch must be 'production' or 'beta'")
    
    # Get system settings
    settings = await db.system_settings.find_one({}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=400, detail="System settings not configured. Please set repository URLs first.")
    
    repo_url = settings.get('production_repo_url') if branch == "production" else settings.get('beta_repo_url')
    if not repo_url:
        raise HTTPException(status_code=400, detail=f"Repository URL for {branch} branch not configured")
    
    try:
        install_dir = ROOT_DIR.parent  # /opt/m3u-panel or wherever installed
        
        # Create a backup before updating
        backup_dir = install_dir / "backup_before_update"
        backup_dir.mkdir(exist_ok=True)
        
        import shutil
        from datetime import datetime
        
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"backup_{timestamp}"
        
        # Backup current installation
        logger.info(f"Creating backup at {backup_path}")
        shutil.copytree(install_dir / "backend", backup_path / "backend", ignore=shutil.ignore_patterns('venv', '__pycache__', '*.pyc', 'backups'))
        shutil.copytree(install_dir / "frontend", backup_path / "frontend", ignore=shutil.ignore_patterns('node_modules', 'build'))
        
        # Pull updates using git
        logger.info(f"Pulling updates from {repo_url}")
        
        # Check if .git exists
        git_dir = install_dir / ".git"
        if not git_dir.exists():
            # Initialize git repo
            result = subprocess.run(['git', 'init'], cwd=install_dir, capture_output=True, text=True)
            if result.returncode != 0:
                raise Exception(f"Git init failed: {result.stderr}")
            
            # Add remote
            result = subprocess.run(['git', 'remote', 'add', 'origin', repo_url], cwd=install_dir, capture_output=True, text=True)
            if result.returncode != 0:
                # Remote might already exist
                subprocess.run(['git', 'remote', 'set-url', 'origin', repo_url], cwd=install_dir, capture_output=True, text=True)
        
        # Fetch updates
        result = subprocess.run(['git', 'fetch', 'origin'], cwd=install_dir, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise Exception(f"Git fetch failed: {result.stderr}")
        
        # Determine which branch to pull
        git_branch = "main" if branch == "production" else "beta"
        
        # Reset to remote branch
        result = subprocess.run(['git', 'reset', '--hard', f'origin/{git_branch}'], cwd=install_dir, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"Git reset failed: {result.stderr}")
        
        # Update system settings
        await db.system_settings.update_one(
            {},
            {
                "$set": {
                    "current_branch": branch,
                    "last_update": datetime.now(timezone.utc),
                    "updated_by": current_user.id
                }
            },
            upsert=True
        )
        
        logger.info("Update pulled successfully")
        
        return {
            "message": "Update pulled successfully. Please run deployment script to apply changes.",
            "branch": branch,
            "backup_location": str(backup_path)
        }
        
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Git operation timed out")
    except Exception as e:
        logger.error(f"Error pulling updates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to pull updates: {str(e)}")

@api_router.post("/system/deploy")
async def deploy_system_update(current_user: User = Depends(get_current_user)):
    """Deploy pulled updates (rebuilds frontend and restarts services) (Super Admin only)"""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can deploy updates")
    
    try:
        install_dir = ROOT_DIR.parent
        
        # Install backend dependencies
        logger.info("Installing backend dependencies...")
        venv_python = install_dir / "backend" / "venv" / "bin" / "python"
        venv_pip = install_dir / "backend" / "venv" / "bin" / "pip"
        
        if venv_pip.exists():
            result = subprocess.run(
                [str(venv_pip), 'install', '-r', 'requirements.txt'],
                cwd=install_dir / "backend",
                capture_output=True,
                text=True,
                timeout=300
            )
            if result.returncode != 0:
                logger.warning(f"Backend dependencies install had warnings: {result.stderr}")
        
        # Install frontend dependencies and build
        logger.info("Installing frontend dependencies...")
        result = subprocess.run(
            ['yarn', 'install'],
            cwd=install_dir / "frontend",
            capture_output=True,
            text=True,
            timeout=300
        )
        if result.returncode != 0:
            raise Exception(f"Yarn install failed: {result.stderr}")
        
        logger.info("Building frontend...")
        result = subprocess.run(
            ['yarn', 'build'],
            cwd=install_dir / "frontend",
            capture_output=True,
            text=True,
            timeout=600
        )
        if result.returncode != 0:
            raise Exception(f"Yarn build failed: {result.stderr}")
        
        # Restart services
        logger.info("Restarting services...")
        subprocess.run(['systemctl', 'restart', 'm3u-backend'], check=False)
        subprocess.run(['systemctl', 'restart', 'm3u-frontend'], check=False)
        
        return {
            "message": "Deployment completed successfully. Services are restarting.",
            "note": "Backend and frontend services are restarting. Please refresh your browser in a few seconds."
        }
        
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Deployment operation timed out")
    except Exception as e:
        logger.error(f"Error deploying updates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to deploy updates: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Start the scheduler when the app starts"""
    # Schedule the refresh job to run every hour
    scheduler.add_job(
        refresh_m3u_playlists,
        'interval',
        hours=1,
        id='refresh_m3u_playlists',
        replace_existing=True
    )
    scheduler.start()
    logger.info("M3U refresh scheduler started - running every hour")
    
    # Run once on startup
    asyncio.create_task(refresh_m3u_playlists())

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()