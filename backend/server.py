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

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str  # super_admin, tenant_owner, user
    tenant_id: Optional[str] = None
    theme: str = "light"  # light or dark
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "user"
    tenant_id: Optional[str] = None

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
    tenant_id: str
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_refresh: Optional[datetime] = None

class M3UPlaylistCreate(BaseModel):
    name: str
    url: str
    content: Optional[str] = None

class M3UPlaylistUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None

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
        tenant_id=current_user.tenant_id,
        created_by=current_user.id
    )
    
    playlist_doc = playlist.model_dump()
    playlist_doc['created_at'] = playlist_doc['created_at'].isoformat()
    playlist_doc['updated_at'] = playlist_doc['updated_at'].isoformat()
    
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