import subprocess
import logging
import sys
import threading

logger = logging.getLogger("vllm-deploy")


def run_command(command, check=True, stream_output=False):
    """
    Run a shell command and return output

    Args:
        command (str): Command to run
        check (bool): If True, raise exception on non-zero exit code
        stream_output (bool): If True, stream command output in real-time

    Returns:
        result: Command execution result with stdout, stderr, and returncode
    """

    logger.info(f"Running command: {command}")

    if stream_output:
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        return_obj = type("CommandResult", (), {})()
        return_obj.stdout = ""
        return_obj.stderr = ""
        return_obj.returncode = None

        def read_stream(stream, is_error):
            for line in stream:
                line = line.rstrip()
                if line:
                    if is_error:
                        logger.error(f"ERROR: {line}")
                        print(f"❌ {line}", file=sys.stderr)
                        return_obj.stderr += line + "\n"
                    else:
                        logger.info(f"OUTPUT: {line}")
                        print(f"➡️ {line}")
                        return_obj.stdout += line + "\n"

        stdout_thread = threading.Thread(
            target=read_stream, args=(process.stdout, False)
        )
        stderr_thread = threading.Thread(
            target=read_stream, args=(process.stderr, True)
        )
        stdout_thread.daemon = True
        stderr_thread.daemon = True
        stdout_thread.start()
        stderr_thread.start()

        # Wait for process to complete
        return_obj.returncode = process.wait()

        # Wait for threads to complete
        stdout_thread.join()
        stderr_thread.join()

        # Check if command was successful
        if check and return_obj.returncode != 0:
            error_msg = (
                f"Command failed with exit code {return_obj.returncode}: {command}"
            )
            logger.error(error_msg)
            raise subprocess.CalledProcessError(return_obj.returncode, command)

        return return_obj

    else:
        try:
            result = subprocess.run(
                command, shell=True, check=check, text=True, capture_output=True
            )

            if result.stdout:
                logger.info(f"Command output:\n{result.stdout}")

            return result
        except subprocess.CalledProcessError as e:
            logger.error(f"Command failed: {e}")
            logger.error(f"Error output: {e.stderr}")
            if check:
                raise
            return e
