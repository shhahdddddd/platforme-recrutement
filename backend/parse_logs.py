import json
import re

log_path = r"c:\PFE\recrutement - Copy\backend\storage\logs\laravel.log"

with open(log_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Look for the last "AI scoring failed" entry
for line in reversed(lines):
    if "AI scoring failed" in line:
        # Extract the JSON part
        match = re.search(r'(\{.*\})', line)
        if match:
            try:
                data = json.loads(match.group(1))
                print("--- ERROR DATA ---")
                print(f"Error Message: {data.get('error')}")
                print(f"STDERR: {data.get('stderr')}")
                print("------------------")
                break
            except:
                continue
