"""
Standardized Agent to Agent (A2A) server implementation following Google ADK standards.
This module provides a FastAPI server implementation for agent-to-agent communication.
"""

import os
import json
import inspect
from typing import Dict, Any, Callable, Optional

from fastapi import FastAPI, Body, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

class AgentRequest(BaseModel):
    """Standard A2A agent request format."""
    message: str = Field(..., description="The message to process")
    context: Dict[str, Any] = Field(default_factory=dict, description="Additional context for the request")
    session_id: Optional[str] = Field(None, description="Session identifier for stateful interactions")

class AgentResponse(BaseModel):
    """Standard A2A agent response format."""
    message: str = Field(..., description="The response message")
    status: str = Field(default="success", description="Status of the response (success, error)")
    data: Dict[str, Any] = Field(default_factory=dict, description="Additional data returned by the agent")
    session_id: Optional[str] = Field(None, description="Session identifier for stateful interactions")

def create_agent_server(
    name: str, 
    description: str, 
    task_manager: Any, 
    endpoints: Optional[Dict[str, Callable]] = None,
    well_known_path: Optional[str] = None,
    capacity_task_manager: Optional[Any] = None,
    risk_task_manager: Optional[Any] = None,
    engagement_task_manager: Optional[Any] = None,
    delivery_staff_task_manager: Optional[Any] = None,
    external_stakeholder_task_manager: Optional[Any] = None
) -> FastAPI:
    """
    Create a FastAPI server for an agent following A2A protocol.
    
    Args:
        name: Agent name
        description: Agent description
        task_manager: TaskManager instance that handles agent processing
        endpoints: Optional additional endpoints to register
        well_known_path: Optional path for .well-known directory
    
    Returns:
        FastAPI application instance
    """
    app = FastAPI(title=f"{name} Agent", description=description)
    
    # CRITICAL: Add CORS middleware with VERY permissive settings first
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow ALL origins temporarily
        allow_credentials=False,  # Set to False when using wildcard
        allow_methods=["*"],  # Allow ALL methods
        allow_headers=["*"],  # Allow ALL headers
    )
    
    # Add a middleware to manually add CORS headers to ALL responses
    @app.middleware("http")
    async def add_cors_headers(request: Request, call_next):
        response = await call_next(request)
        
        # Add CORS headers to every response
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Accept, Accept-Language, Content-Language, Content-Type, Authorization, X-Requested-With, Origin"
        response.headers["Access-Control-Max-Age"] = "86400"
        
        return response

    # Create .well-known directory if it doesn't exist
    if well_known_path is None:
        module_path = inspect.getmodule(inspect.stack()[1][0]).__file__
        well_known_path = os.path.join(os.path.dirname(module_path), ".well-known")
    
    os.makedirs(well_known_path, exist_ok=True)
    
    # Generate agent.json if it doesn't exist
    agent_json_path = os.path.join(well_known_path, "agent.json")
    if not os.path.exists(agent_json_path):
        endpoint_names = ["run"]
        if endpoints:
            endpoint_names.extend(endpoints.keys())
        
        agent_metadata = {
            "name": name,
            "description": description,
            "endpoints": endpoint_names,
            "version": "1.0.0"
        }
        
        with open(agent_json_path, "w") as f:
            json.dump(agent_metadata, f, indent=2)
    
    # Standard A2A run endpoint: Riley
    @app.post("/run", response_model=AgentResponse)
    async def run(request: AgentRequest = Body(...)):
        try:
            result = await task_manager.process_task(request.message, request.context, request.session_id)
            return AgentResponse(
                message=result.get("message", "Task completed"),
                status=result.get("status", "success"),
                data=result.get("data", {}),
                session_id=result.get("session_id", request.session_id)
            )
        except Exception as e:
            return AgentResponse(
                message=f"Error processing request: {str(e)}",
                status="error",
                data={"error_type": type(e).__name__},
                session_id=request.session_id
            )
    
    # CAPACITY_AGENT:
    @app.post("/capacity_agent", response_model=AgentResponse)
    async def capacity_agent(request: AgentRequest = Body(...)):
        try:
            if not capacity_task_manager:
                raise ValueError("CapacityAgent TaskManager not configured")
            result = await capacity_task_manager.process_task(request.message, request.context, request.session_id)
            return AgentResponse(
                message=result.get("message", "Task completed"),
                status=result.get("status", "success"),
                data=result.get("data", {}),
                session_id=result.get("session_id", request.session_id)
            )
        except Exception as e:
            return AgentResponse(
                message=f"Error processing request: {str(e)}",
                status="error",
                data={"error_type": type(e).__name__},
                session_id=request.session_id
            )
        
    @app.post("/risk_agent", response_model=AgentResponse)
    async def risk_agent(request: AgentRequest = Body(...)):
        try:
            if not risk_task_manager:
                raise ValueError("RiskAgent TaskManager not configured")
            result = await risk_task_manager.process_task(request.message, request.context, request.session_id)
            return AgentResponse(
                message=result.get("message", "Task completed"),
                status=result.get("status", "success"),
                data=result.get("data", {}),
                session_id=result.get("session_id", request.session_id)
            )
        except Exception as e:
            return AgentResponse(
                message=f"Error processing request: {str(e)}",
                status="error",
                data={"error_type": type(e).__name__},
                session_id=request.session_id
            )
        
    @app.post("/engagement_agent", response_model=AgentResponse)
    async def engagement_agent(request: AgentRequest = Body(...)):
        try:
            if not engagement_task_manager:
                raise ValueError("EngagementAgent TaskManager not configured")
            result = await engagement_task_manager.process_task(request.message, request.context, request.session_id)
            return AgentResponse(
                message=result.get("message", "Task completed"),
                status=result.get("status", "success"),
                data=result.get("data", {}),
                session_id=result.get("session_id", request.session_id)
            )
        except Exception as e:
            return AgentResponse(
                message=f"Error processing request: {str(e)}",
                status="error",
                data={"error_type": type(e).__name__},
                session_id=request.session_id
            )
        
    @app.post("/external_stakeholder_agent", response_model=AgentResponse)
    async def external_stakeholder_agent(request: AgentRequest = Body(...)):
        try:
            if not external_stakeholder_task_manager:
                raise ValueError("ExternalStakeholderAgent TaskManager not configured")
            result = await external_stakeholder_task_manager.process_task(request.message, request.context, request.session_id)
            return AgentResponse(
                message=result.get("message", "Task completed"),
                status=result.get("status", "success"),
                data=result.get("data", {}),
                session_id=result.get("session_id", request.session_id)
            )
        except Exception as e:
            return AgentResponse(
                message=f"Error processing request: {str(e)}",
                status="error",
                data={"error_type": type(e).__name__},
                session_id=request.session_id
            )
        
    @app.post("/delivery_staff_agent", response_model=AgentResponse)
    async def delivery_staff_agent(request: AgentRequest = Body(...)):
        try:
            if not delivery_staff_task_manager:
                raise ValueError("DeliveryStaffAgent TaskManager not configured")
            result = await delivery_staff_task_manager.process_task(request.message, request.context, request.session_id)
            return AgentResponse(
                message=result.get("message", "Task completed"),
                status=result.get("status", "success"),
                data=result.get("data", {}),
                session_id=result.get("session_id", request.session_id)
            )
        except Exception as e:
            return AgentResponse(
                message=f"Error processing request: {str(e)}",
                status="error",
                data={"error_type": type(e).__name__},
                session_id=request.session_id
            )

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "agent": name}
    
    # CORS test endpoint
    @app.get("/cors-test")
    async def cors_test():
        """Test CORS configuration."""
        return {"message": "CORS is working", "timestamp": "2025-01-01", "cors": "enabled"}
    
    # Metadata endpoint
    @app.get("/.well-known/agent.json")
    async def get_metadata():
        """Retrieve the agent metadata."""
        with open(agent_json_path, "r") as f:
            return JSONResponse(content=json.load(f))
    
    # Debug endpoint for testing
    @app.get("/debug")
    async def debug_info():
        """Debug information endpoint."""
        return {
            "agent_name": name,
            "app_name": task_manager.runner.app_name if hasattr(task_manager, 'runner') else "unknown",
            "available_endpoints": ["run", "health", "debug", "cors-test", ".well-known/agent.json"] + (list(endpoints.keys()) if endpoints else [])
        }
    
    # Register additional endpoints if provided
    if endpoints:
        for path, handler in endpoints.items():
            app.add_api_route(f"/{path}", handler, methods=["POST"])
    
    return app