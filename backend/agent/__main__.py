"""
Entry point for the Strategic Consultant Agent.
Initializes and starts the agent's server.
"""

import os
import sys
import logging
import asyncio
from dotenv import load_dotenv

# Add the parent directory (backend) to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import TaskManagers and agents
from .task_manager import TaskManager, TaskManager_CapacityAgent, TaskManager_ExternalStakeholderAgent, TaskManager_RiskAgent, TaskManager_EngagementAgent
from .task_manager_delivery_staff import TaskManager_DeliveryStaffAgent
from .agent import root_agent, capacity_agent, risk_agent, engagement_agent, external_stakeholder_agent
from .agent_delivery_staff import delivery_staff_agent
from common.a2a_server import create_agent_server

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path, override=True)

# Global variables for TaskManager instances
task_manager_instance: TaskManager = None
capacity_task_manager_instance: TaskManager_CapacityAgent = None
risk_task_manager_instance: TaskManager_RiskAgent = None
engagement_task_manager_instance: TaskManager_EngagementAgent = None
external_stakeholder_task_manager_instance: TaskManager_ExternalStakeholderAgent = None
delivery_staff_task_manager_instance: TaskManager_DeliveryStaffAgent = None

async def main():
    """Initialize and start the Strategic Consultant Agent server."""
    global task_manager_instance, capacity_task_manager_instance, risk_task_manager_instance, engagement_task_manager_instance, external_stakeholder_task_manager_instance, delivery_staff_task_manager_instance

    logger.info("Starting Strategic Consultant Agent A2A Server initialization...")

    # Initialize TaskManagers
    task_manager_instance = TaskManager(agent=root_agent)
    capacity_task_manager_instance = TaskManager_CapacityAgent(agent=capacity_agent)
    risk_task_manager_instance = TaskManager_RiskAgent(agent=risk_agent)
    engagement_task_manager_instance = TaskManager_EngagementAgent(agent=engagement_agent)
    external_stakeholder_task_manager_instance = TaskManager_ExternalStakeholderAgent(agent=external_stakeholder_agent)
    delivery_staff_task_manager_instance = TaskManager_DeliveryStaffAgent(agent=delivery_staff_agent)

    logger.info("TaskManagers initialized (Priority + Capacity + Risk + Engagement + ExternalStakeholder + DeliveryStaff).")

    # Host/port config
    host = os.getenv("CONSULTANT_A2A_HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("CONSULTANT_A2A_PORT", "8004")))

    # Create the FastAPI app
    app = create_agent_server(
        name=root_agent.name,
        description=root_agent.description,
        task_manager=task_manager_instance,
        capacity_task_manager=capacity_task_manager_instance,
        risk_task_manager=risk_task_manager_instance,
        engagement_task_manager=engagement_task_manager_instance,
        external_stakeholder_task_manager=external_stakeholder_task_manager_instance,
        delivery_staff_task_manager=delivery_staff_task_manager_instance,
    )

    logger.info(f"Strategic Consultant Agent A2A server starting on {host}:{port}")
    
    import uvicorn
    config = uvicorn.Config(app, host=host, port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()
    
    logger.info("Strategic Consultant Agent A2A server stopped.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Strategic Consultant Agent server stopped by user.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Error during server startup: {str(e)}", exc_info=True)
        sys.exit(1)
