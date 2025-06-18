from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import json
import re

# AI Provider imports
from emergentintegrations.llm.chat import LlmChat, UserMessage
import httpx
import groq
import openai
import anthropic
import google.generativeai as genai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="AI SEO Writer", description="SaaS platform for AI-powered SEO content generation")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)

# Data Models
class APIKeys(BaseModel):
    openai_key: Optional[str] = None
    anthropic_key: Optional[str] = None
    gemini_key: Optional[str] = None
    groq_key: Optional[str] = None
    grok_key: Optional[str] = None

class UserSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    api_keys: APIKeys
    preferred_provider: Optional[str] = None
    preferred_model: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ContentGenerationRequest(BaseModel):
    keyword: str
    provider: str
    model: str
    tone: str = "informative"
    word_count: int = 1000
    api_key: str
    include_faq: bool = True
    include_schema: bool = True

class SEOContent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    keyword: str
    title: str
    meta_description: str
    content: str
    h1_tag: str
    h2_tags: List[str]
    h3_tags: List[str]
    faq_section: Optional[str] = None
    schema_markup: Optional[str] = None
    word_count: int
    provider: str
    model: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    content_count: int = 0

# Available Models for each provider
AVAILABLE_MODELS = {
    "openai": [
        "gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
        "o1", "o1-mini", "o1-pro", "o3", "o3-mini", "o4-mini"
    ],
    "anthropic": [
        "claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-7-sonnet-20250219",
        "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"
    ],
    "gemini": [
        "gemini-2.5-flash-preview-04-17", "gemini-2.5-pro-preview-05-06", "gemini-2.0-flash",
        "gemini-2.0-flash-preview-image-generation", "gemini-2.0-flash-lite",
        "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"
    ],
    "groq": [
        "llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant",
        "mixtral-8x7b-32768", "gemma-7b-it"
    ],
    "grok": [
        "grok-beta", "grok-vision-beta"
    ]
}

# SEO Content Generator Class
class SEOContentGenerator:
    def __init__(self):
        self.session_counter = 0
    
    async def generate_content(self, request: ContentGenerationRequest) -> SEOContent:
        """Generate SEO-optimized content using the specified AI provider"""
        
        # Create session ID
        self.session_counter += 1
        session_id = f"seo_session_{self.session_counter}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Generate content based on provider
        if request.provider == "openai" or request.provider == "anthropic" or request.provider == "gemini":
            content_data = await self._generate_with_emergent_integration(request, session_id)
        elif request.provider == "groq":
            content_data = await self._generate_with_groq(request)
        elif request.provider == "grok":
            content_data = await self._generate_with_grok(request)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {request.provider}")
        
        # Process and structure the content
        return self._process_content(content_data, request)
    
    async def _generate_with_emergent_integration(self, request: ContentGenerationRequest, session_id: str) -> str:
        """Generate content using emergent integrations library"""
        try:
            chat = LlmChat(
                api_key=request.api_key,
                session_id=session_id,
                system_message=self._get_seo_system_message(request.tone)
            )
            
            # Configure the model
            chat.with_model(request.provider, request.model)
            chat.with_max_tokens(min(request.word_count * 2, 4000))
            
            # Create the user message
            user_message = UserMessage(
                text=self._create_content_prompt(request)
            )
            
            # Generate content
            response = await chat.send_message(user_message)
            return response
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating content with {request.provider}: {str(e)}")
    
    async def _generate_with_groq(self, request: ContentGenerationRequest) -> str:
        """Generate content using Groq API"""
        try:
            client = groq.Groq(api_key=request.api_key)
            
            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": self._get_seo_system_message(request.tone)},
                    {"role": "user", "content": self._create_content_prompt(request)}
                ],
                model=request.model,
                max_tokens=min(request.word_count * 2, 4000),
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating content with Groq: {str(e)}")
    
    async def _generate_with_grok(self, request: ContentGenerationRequest) -> str:
        """Generate content using Grok (xAI) API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.x.ai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {request.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "messages": [
                            {"role": "system", "content": self._get_seo_system_message(request.tone)},
                            {"role": "user", "content": self._create_content_prompt(request)}
                        ],
                        "model": request.model,
                        "max_tokens": min(request.word_count * 2, 4000),
                        "temperature": 0.7
                    }
                )
                
                if response.status_code != 200:
                    raise HTTPException(status_code=response.status_code, detail=f"Grok API error: {response.text}")
                
                result = response.json()
                return result["choices"][0]["message"]["content"]
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating content with Grok: {str(e)}")
    
    def _get_seo_system_message(self, tone: str) -> str:
        """Get system message for SEO content generation"""
        return f"""You are an expert SEO content writer. Your task is to create high-quality, SEO-optimized blog posts that rank well in search engines.

Writing Guidelines:
- Tone: {tone}
- Follow SEO best practices for content structure
- Use the focus keyword strategically throughout the content
- Create engaging, readable content that provides value
- Include proper heading hierarchy (H1, H2, H3)
- Write compelling meta descriptions
- Ensure content flows naturally while being SEO-optimized

Content Structure Requirements:
1. SEO Title (60 characters max)
2. Meta Description (155 characters max) 
3. H1 Tag (include focus keyword)
4. Introduction paragraph
5. Main content with H2 and H3 subheadings
6. FAQ section (if requested)
7. Conclusion
8. Schema markup (if requested)

Output Format:
Return the content as a JSON object with the following structure:
{{
  "seo_title": "SEO optimized title",
  "meta_description": "Meta description",
  "h1_tag": "Main H1 heading",
  "content": "Full article content with proper HTML formatting",
  "h2_tags": ["H2 heading 1", "H2 heading 2"],
  "h3_tags": ["H3 heading 1", "H3 heading 2"],
  "faq_section": "FAQ content if requested",
  "schema_markup": "JSON-LD schema markup if requested"
}}"""
    
    def _create_content_prompt(self, request: ContentGenerationRequest) -> str:
        """Create the content generation prompt"""
        prompt = f"""Create a comprehensive, SEO-optimized blog post about "{request.keyword}".

Requirements:
- Focus keyword: {request.keyword}
- Target word count: {request.word_count} words
- Writing tone: {request.tone}
- Include FAQ section: {request.include_faq}
- Include schema markup: {request.include_schema}

Make sure to:
1. Use the focus keyword in the title, H1, and throughout the content naturally
2. Create engaging subheadings that include related keywords
3. Write content that answers user intent for the keyword
4. Include actionable insights and valuable information
5. Optimize for readability and SEO

Return the content in the specified JSON format."""
        
        return prompt
    
    def _process_content(self, content_data: str, request: ContentGenerationRequest) -> SEOContent:
        """Process the generated content and create SEOContent object"""
        try:
            # Try to parse as JSON first
            if content_data.strip().startswith('{'):
                parsed_data = json.loads(content_data)
                return SEOContent(
                    keyword=request.keyword,
                    title=parsed_data.get("seo_title", f"Complete Guide to {request.keyword}"),
                    meta_description=parsed_data.get("meta_description", f"Learn everything about {request.keyword}. Complete guide with expert insights and practical tips."),
                    content=parsed_data.get("content", content_data),
                    h1_tag=parsed_data.get("h1_tag", f"Complete Guide to {request.keyword}"),
                    h2_tags=parsed_data.get("h2_tags", []),
                    h3_tags=parsed_data.get("h3_tags", []),
                    faq_section=parsed_data.get("faq_section") if request.include_faq else None,
                    schema_markup=parsed_data.get("schema_markup") if request.include_schema else None,
                    word_count=len(content_data.split()),
                    provider=request.provider,
                    model=request.model
                )
            else:
                # Process as plain text
                return self._extract_seo_elements(content_data, request)
                
        except json.JSONDecodeError:
            # Fallback to text processing
            return self._extract_seo_elements(content_data, request)
    
    def _extract_seo_elements(self, content: str, request: ContentGenerationRequest) -> SEOContent:
        """Extract SEO elements from plain text content"""
        lines = content.split('\n')
        
        # Extract title (first line or first heading)
        title = f"Complete Guide to {request.keyword}"
        h1_tag = title
        h2_tags = []
        h3_tags = []
        
        for line in lines:
            line = line.strip()
            if line.startswith('# '):
                title = line[2:].strip()
                h1_tag = title
            elif line.startswith('## '):
                h2_tags.append(line[3:].strip())
            elif line.startswith('### '):
                h3_tags.append(line[4:].strip())
        
        # Generate meta description
        first_paragraph = ""
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#') and len(line) > 50:
                first_paragraph = line[:150] + "..."
                break
        
        meta_description = first_paragraph or f"Learn everything about {request.keyword}. Complete guide with expert insights and practical tips."
        
        return SEOContent(
            keyword=request.keyword,
            title=title,
            meta_description=meta_description,
            content=content,
            h1_tag=h1_tag,
            h2_tags=h2_tags,
            h3_tags=h3_tags,
            word_count=len(content.split()),
            provider=request.provider,
            model=request.model
        )

# Initialize the content generator
content_generator = SEOContentGenerator()

# API Routes
@api_router.get("/")
async def root():
    return {"message": "AI SEO Writer API", "version": "1.0.0"}

@api_router.get("/models")
async def get_available_models():
    """Get all available models for each provider"""
    return {"models": AVAILABLE_MODELS}

@api_router.post("/test-api-key")
async def test_api_key(provider: str, api_key: str, model: str):
    """Test if an API key is valid for a specific provider"""
    try:
        if provider == "openai":
            client = openai.OpenAI(api_key=api_key)
            # Test with a simple completion
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10
            )
            return {"valid": True, "provider": provider, "model": model}
            
        elif provider == "anthropic":
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model=model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hello"}]
            )
            return {"valid": True, "provider": provider, "model": model}
            
        elif provider == "gemini":
            genai.configure(api_key=api_key)
            model_obj = genai.GenerativeModel(model)
            response = model_obj.generate_content("Hello")
            return {"valid": True, "provider": provider, "model": model}
            
        elif provider == "groq":
            client = groq.Groq(api_key=api_key)
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10
            )
            return {"valid": True, "provider": provider, "model": model}
            
        elif provider == "grok":
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.x.ai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "messages": [{"role": "user", "content": "Hello"}],
                        "model": model,
                        "max_tokens": 10
                    }
                )
                if response.status_code == 200:
                    return {"valid": True, "provider": provider, "model": model}
                else:
                    return {"valid": False, "error": response.text}
        else:
            return {"valid": False, "error": "Unsupported provider"}
            
    except Exception as e:
        return {"valid": False, "error": str(e)}

@api_router.post("/generate-content", response_model=SEOContent)
async def generate_seo_content(request: ContentGenerationRequest):
    """Generate SEO-optimized content"""
    try:
        # Validate the model is available for the provider
        if request.model not in AVAILABLE_MODELS.get(request.provider, []):
            raise HTTPException(
                status_code=400, 
                detail=f"Model {request.model} is not available for provider {request.provider}"
            )
        
        # Generate the content
        content = await content_generator.generate_content(request)
        
        # Save to database
        await db.seo_content.insert_one(content.dict())
        
        return content
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/content", response_model=List[SEOContent])
async def get_content_history(limit: int = 10):
    """Get content generation history"""
    try:
        cursor = db.seo_content.find().sort("created_at", -1).limit(limit)
        content_list = await cursor.to_list(length=limit)
        return [SEOContent(**content) for content in content_list]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/content/{content_id}", response_model=SEOContent)
async def get_content_by_id(content_id: str):
    """Get specific content by ID"""
    try:
        content = await db.seo_content.find_one({"id": content_id})
        if not content:
            raise HTTPException(status_code=404, detail="Content not found")
        return SEOContent(**content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/settings", response_model=UserSettings)
async def save_user_settings(settings: UserSettings):
    """Save user settings including API keys"""
    try:
        settings.updated_at = datetime.utcnow()
        await db.user_settings.replace_one(
            {"user_id": settings.user_id},
            settings.dict(),
            upsert=True
        )
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/settings/{user_id}", response_model=UserSettings)
async def get_user_settings(user_id: str):
    """Get user settings"""
    try:
        settings = await db.user_settings.find_one({"user_id": user_id})
        if not settings:
            # Return default settings
            return UserSettings(user_id=user_id, api_keys=APIKeys())
        return UserSettings(**settings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()