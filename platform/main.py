#!/usr/bin/env python3

import logging
import subprocess
import sys

from deployment.deploy_vllm import deploy_vllm
from deployment.parser import parse_args

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("vllm-deploy")


def main():
    args = parse_args()

    if args.debug:
        logger.setLevel(logging.DEBUG)

    success = deploy_vllm(args)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
