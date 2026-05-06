#!/usr/bin/env python
import sys
import os
from multiprocessing import freeze_support

sys.path.insert(0, os.path.dirname(__file__))

if __name__ == '__main__':
    freeze_support()
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)