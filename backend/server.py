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
                    
                    # Extract relevant fields - adjust based on actual API response
                    result["max_connections"] = data.get("max_connections") or data.get("maxConnections") or data.get("max_cons")
                    result["active_connections"] = data.get("active_connections") or data.get("activeConnections") or data.get("active_cons")
                    result["expiration_date"] = data.get("exp_date") or data.get("expiration_date") or data.get("expires")
                    
                    # If expiration is a timestamp, convert it
                    if result["expiration_date"] and isinstance(result["expiration_date"], (int, float)):
                        exp_dt = datetime.fromtimestamp(result["expiration_date"], tz=timezone.utc)
                        result["expiration_date"] = exp_dt.isoformat()
                else:
                    result["error"] = f"HTTP {response.status}"
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Error fetching player API data: {str(e)}")
    
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

class UserLogin(BaseModel):
    username: str
    password: str

class Tenant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    owner_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class TenantCreate(BaseModel):
    name: str
    owner_username: str
    owner_password: str

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
    
    return User(**user_doc)

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
    
    # Create tenant
    tenant = Tenant(
        name=tenant_data.name,
        owner_id="",  # Will be set after owner is created
        created_by=current_user.id
    )
    
    tenant_doc = tenant.model_dump()
    tenant_doc['created_at'] = tenant_doc['created_at'].isoformat()
    
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
    return Tenant(**tenant_doc)

@api_router.get("/tenants", response_model=List[Tenant])
async def get_tenants(current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can view all tenants")
    
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(1000)
    
    for tenant in tenants:
        if isinstance(tenant['created_at'], str):
            tenant['created_at'] = datetime.fromisoformat(tenant['created_at'])
    
    return tenants

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
    
    return playlist

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

@api_router.get("/categories")
async def get_categories(current_user: User = Depends(get_current_user)):
    """Get all unique categories from playlists in user's tenant"""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    
    # Get all playlists for the tenant
    playlists = await db.m3u_playlists.find({"tenant_id": current_user.tenant_id}, {"_id": 0}).to_list(1000)
    
    categories = set()
    
    for playlist in playlists:
        if playlist.get('content'):
            channels = parse_m3u_content(playlist['content'])
            
            for channel in channels:
                if channel.get('group'):
                    categories.add(channel['group'])
    
    return sorted(list(categories))

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

# Profile routes
@api_router.put("/profile/theme")
async def update_theme(theme_data: ThemeUpdate, current_user: User = Depends(get_current_user)):
    if theme_data.theme not in ["light", "dark"]:
        raise HTTPException(status_code=400, detail="Theme must be 'light' or 'dark'")
    
    await db.users.update_one({"id": current_user.id}, {"$set": {"theme": theme_data.theme}})
    return {"message": "Theme updated successfully"}

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