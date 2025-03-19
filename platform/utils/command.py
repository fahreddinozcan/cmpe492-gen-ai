import logging
import subprocess

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("vllm-deploy")


def run_command(command, check=True):
    """Run a shell command and return output"""
    logger.info(f"Running command: {command}")
    result = subprocess.run(
        command, shell=True, check=check, text=True, capture_output=True
    )
    return result
