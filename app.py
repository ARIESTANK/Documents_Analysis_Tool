import os
from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from services.google_key_pool import GoogleApiKeysRateLimited
from routes.projects import projects_bp
from routes.documents import documents_bp
from routes.chat import chat_bp
from routes.summary import summary_bp
from routes.compare import compare_bp
from routes.sdd_analysis import sdd_analysis_bp
from routes.analysis import analysis_bp
from routes.translate import translate_bp


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = Config.MAX_CONTENT_LENGTH
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        allow_headers=["Content-Type", "Authorization"],
    )

    app.register_blueprint(projects_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(summary_bp)
    app.register_blueprint(compare_bp)
    app.register_blueprint(sdd_analysis_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(translate_bp)

    key_count = len(Config.google_api_keys())
    if key_count == 0:
        print("[startup] WARNING: no Google API keys loaded (GOOGLE_API_KEY is unset)")
    else:
        print(f"[startup] Google API key pool: {key_count} distinct key(s) loaded")

    @app.errorhandler(GoogleApiKeysRateLimited)
    def handle_all_keys_rate_limited(error: GoogleApiKeysRateLimited):
        # Every key in the pool is on cooldown at once — tell the client
        # exactly how long to wait instead of surfacing a generic 500.
        response = jsonify({
            "error": "All Google API keys are currently rate-limited. Please try again shortly.",
            "retry_after_seconds": error.retry_after_seconds,
        })
        response.status_code = 429
        response.headers["Retry-After"] = str(error.retry_after_seconds)
        return response

    @app.get("/api/health")
    def health():
        missing = Config.validate()
        return jsonify({
            "status": "ok" if not missing else "missing_config",
            "missing_env_vars": missing,
        })

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)