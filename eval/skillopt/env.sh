# source before running SkillOpt on call-pele-answer (Hark sandbox)
export OPENAI_COMPATIBLE_BASE_URL=https://apihub.agnes-ai.com/v1
export OPENAI_COMPATIBLE_API_KEY="${AGNES_API_KEY}"   # proxy injects the real key
export OPENAI_COMPATIBLE_MODEL=agnes-3.0-flash
export OPENAI_COMPATIBLE_TEMPERATURE=0.3
export OPENAI_COMPATIBLE_TIMEOUT_SECONDS=240
export PATH=/workspace/tools/so-venv/bin:$PATH
cd /workspace/work/ref/SkillOpt
