# vDeploy Setup and Usage Instructions

## Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
- [Helm](https://helm.sh/docs/intro/install/)
- [Python 3.8+](https://www.python.org/downloads/)
- [Node.js 16+](https://nodejs.org/) (for frontend console)

## 1. Setting Up Google Cloud

Before setting up vDeploy, you need to have a fully activated Google Cloud account. If you don't have one, you can create one at [Google Cloud Console](https://console.cloud.google.com/).

**Note:** If you're using a free tier account, you can get $300 in credits for free usage. However, to use vDeploy, you need to have a billing account linked to your Google Cloud account, and you need to have a valid credit card on file. Once you enable billing, you won't be charged until you run out of free credits.

### 1.1 Authenticate Google Cloud

```bash
gcloud auth login
```

### 1.2 Set Your Project

```bash
gcloud config set project YOUR_PROJECT_ID
```

**Note:** You can find your existing projects either from the [Google Cloud Console](https://console.cloud.google.com/) or by running `gcloud projects list` in the terminal.

## 2. Quick Setup with run-dev.sh

For a quick setup of the development environment, you can use the provided script:

```bash
chmod +x run-dev.sh
./run-dev.sh
```

This script will:

- Check for all required dependencies
- Install necessary packages
- Set up both frontend and backend environments
- Start the development servers

If you prefer to set up manually or need more control, continue with the steps below.

<details>
  <summary>Click to see the expected execution output</summary>

    ```shell
    $ ./run-dev.sh
    === vDeploy Development Environment Setup ===
    Checking required tools...
    ✓ Python 3.13 found
    ✓ pip3 found
    ✓ Node.js 19.9.0 found
    ✓ npm found
    ✓ Google Cloud SDK found
    ✓ Google Cloud authentication active
    ✓ Google Cloud project set to: cmpe492-452009
    ✓ kubectl found
    ✓ Helm found
    Installing backend dependencies...
    Creating Python virtual environment...
    Installing Python dependencies from requirements.txt...
    ....
    Installing collected packages: durationpy, websockets, websocket-client, urllib3, typing-extensions, sniffio, six, PyYAML, python-multipart, pyasn1, oauthlib, idna, h11, click, charset-normalizer, certifi, cachetools, annotated-types, uvicorn, typing-inspection, rsa, requests, python-dateutil, pydantic-core, pyasn1-modules, httpcore, anyio, starlette, requests-oauthlib, pydantic, httpx, google-auth, kubernetes, fastapi
    Successfully installed PyYAML-6.0.2 annotated-types-0.7.0 anyio-4.9.0 cachetools-5.5.2 certifi-2025.4.26 charset-normalizer-3.4.2 click-8.2.0 durationpy-0.9 fastapi-0.115.12 google-auth-2.40.1 h11-0.16.0 httpcore-1.0.9 httpx-0.28.1 idna-3.10 kubernetes-32.0.1 oauthlib-3.2.2 pyasn1-0.6.1 pyasn1-modules-0.4.2 pydantic-2.11.4 pydantic-core-2.33.2 python-dateutil-2.9.0.post0 python-multipart-0.0.20 requests-2.32.3 requests-oauthlib-2.0.0 rsa-4.9.1 six-1.17.0 sniffio-1.3.1 starlette-0.46.2 typing-extensions-4.13.2 typing-inspection-0.4.0 urllib3-2.4.0 uvicorn-0.34.2 websocket-client-1.8.0 websockets-15.0.1
    ...
    Installing frontend dependencies...
    ✓ Frontend dependencies already installed
    Setup complete! Starting services...
    Starting backend service...
    Starting frontend service...
    Both services are running!
    Backend: http://localhost:8000
    Frontend: http://localhost:5173
    Press Ctrl+C to stop all services
    INFO:     Will watch for changes in these directories: ['/Users/fahreddinozcan/Desktop/2024-2025/cmpe492/cmpe492-gen-ai/platform/backend']
    INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
    INFO:     Started reloader process [23515] using StatReload

    > dev
    > react-router dev

    ```

</details>
