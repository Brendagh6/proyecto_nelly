import cv2
import mediapipe as mp
import numpy as np
import base64
import os
import psycopg2
import datetime
import bcrypt
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ====================== CONFIGURACIÓN ======================
def get_db_connection():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASS')
    )
    return conn

def _fetchone_dict(cur):
    row = cur.fetchone()
    if not row:
        return None
    cols = [getattr(d, "name", d[0]) for d in cur.description]
    return dict(zip(cols, row))

def _user_public_row(row):
    if not row:
        return None
    return {"id": row[0], "nombre": row[1], "email": row[2]}

def _hash_password(password: str) -> str:
    pw = password.encode("utf-8")
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")

def _check_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False

# ====================== MEDIAPIPE ======================
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, refine_landmarks=True)

OJO_IZQ = [362, 385, 387, 263, 373, 380]
OJO_DER = [33, 160, 158, 133, 153, 144]

def calcular_ear(landmarks, indices):
    p2_p6 = np.linalg.norm(np.array([landmarks[indices[1]].x, landmarks[indices[1]].y]) - 
                        np.array([landmarks[indices[5]].x, landmarks[indices[5]].y]))
    p3_p5 = np.linalg.norm(np.array([landmarks[indices[2]].x, landmarks[indices[2]].y]) - 
                        np.array([landmarks[indices[4]].x, landmarks[indices[4]].y]))
    p1_p4 = np.linalg.norm(np.array([landmarks[indices[0]].x, landmarks[indices[0]].y]) - 
                        np.array([landmarks[indices[3]].x, landmarks[indices[3]].y]))
    return (p2_p6 + p3_p5) / (2.0 * p1_p4)

# ====================== RUTAS ======================

@app.route('/')
def index():
    return "ProLife API: Energy Co-pilot is Running! 🦊⚡"

# ==================== USUARIOS ====================
@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.json or {}
        nombre = (data.get("nombre") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not nombre or not email or not password:
            return jsonify({"error": "nombre, email y password son requeridos"}), 400

        password_hash = _hash_password(password)

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO usuarios (nombre, email, password_hash, id_rol)
            VALUES (%s, %s, %s, %s)
            RETURNING id_usuario, nombre, email
            """,
            (nombre, email, password_hash, 2),
        )
        user_row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify(_user_public_row(user_row)), 201
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está registrado"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            return jsonify({"error": "email y password son requeridos"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id_usuario, nombre, email, password_hash FROM usuarios WHERE email = %s",
            (email,),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row or not _check_password(password, row[3]):
            return jsonify({"error": "Credenciales inválidas"}), 401

        return jsonify(_user_public_row(row))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== PERFIL ====================
@app.route('/perfil/<int:id_usuario>', methods=['GET'])
def get_perfil(id_usuario: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_usuario, tipo_trabajo, area, turno, hora_inicio, hora_fin, 
                   dias_trabajo, horas_sueno_promedio
            FROM perfil_usuario WHERE id_usuario = %s
            """, (id_usuario,))
        perfil = _fetchone_dict(cur)
        cur.close()
        conn.close()

        if not perfil:
            return jsonify({"error": "Perfil no encontrado"}), 404

        for k, v in list(perfil.items()):
            if isinstance(v, (datetime.time, datetime.date, datetime.datetime)):
                perfil[k] = v.isoformat()

        return jsonify(perfil)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/perfil', methods=['POST'])
def upsert_perfil():
    try:
        data = request.json or {}
        id_usuario = data.get("id_usuario")
        if not id_usuario:
            return jsonify({"error": "id_usuario es requerido"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO perfil_usuario (id_usuario, tipo_trabajo, area, turno, 
                                       hora_inicio, hora_fin, dias_trabajo, horas_sueno_promedio)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id_usuario) DO UPDATE SET
                tipo_trabajo = EXCLUDED.tipo_trabajo,
                area = EXCLUDED.area,
                turno = EXCLUDED.turno,
                hora_inicio = EXCLUDED.hora_inicio,
                hora_fin = EXCLUDED.hora_fin,
                dias_trabajo = EXCLUDED.dias_trabajo,
                horas_sueno_promedio = EXCLUDED.horas_sueno_promedio,
                actualizado_en = CURRENT_TIMESTAMP
            RETURNING id_usuario
            """,
            (id_usuario, data.get("tipo_trabajo"), data.get("area"), data.get("turno"),
             data.get("hora_inicio"), data.get("hora_fin"), data.get("dias_trabajo"),
             data.get("horas_sueno_promedio"))
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"ok": True, "id_usuario": id_usuario})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== FATIGA ====================
@app.route('/analizar_fatiga', methods=['POST'])
def analizar_fatiga():
    try:
        data = request.json or {}
        image_data = data['image'].split(",")[1]
        
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        results = face_mesh.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        
        if not results.multi_face_landmarks:
            return jsonify({"estado": "Rostro no detectado", "nivel": 0})

        landmarks = results.multi_face_landmarks[0].landmark
        ear_izq = calcular_ear(landmarks, OJO_IZQ)
        ear_der = calcular_ear(landmarks, OJO_DER)
        ear_promedio = (ear_izq + ear_der) / 2.0

        if ear_promedio < 0.21:
            estado, nivel = "Fatiga Alta (Ojos casi cerrados)", 3
        elif ear_promedio < 0.26:
            estado, nivel = "Fatiga Moderada (Cansancio)", 2
        else:
            estado, nivel = "Normal / Despierto", 1

        payload = {
            "estado": estado,
            "ear": round(ear_promedio, 3),
            "nivel": nivel
        }

        id_usuario = data.get("id_usuario")
        if id_usuario:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO registros_fatiga (id_usuario, estado, ear, nivel) VALUES (%s, %s, %s, %s)",
                (id_usuario, estado, round(float(ear_promedio), 3), int(nivel))
            )
            cur.execute(
                "INSERT INTO logs_energia (id_usuario, nivel_fatiga_detectado) VALUES (%s, %s)",
                (id_usuario, int(nivel))
            )
            conn.commit()
            cur.close()
            conn.close()
            payload["guardado"] = True

        return jsonify(payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/historial_fatiga/<int:id_usuario>', methods=['GET'])
def historial_fatiga(id_usuario):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT estado, ear, nivel, creado_en 
            FROM registros_fatiga 
            WHERE id_usuario = %s 
            ORDER BY creado_en DESC LIMIT 30
        """, (id_usuario,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        historial = [{
            "estado": row[0],
            "ear": float(row[1]) if row[1] else None,
            "nivel": row[2],
            "fecha": row[3].isoformat() if row[3] else None
        } for row in rows]
        return jsonify(historial)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ====================== TAREAS ======================
@app.route('/tareas/<int:id_usuario>', methods=['GET'])
def get_tareas(id_usuario):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id_tarea, titulo, descripcion, estado, prioridad, creado_en
            FROM tareas 
            WHERE id_usuario = %s 
            ORDER BY prioridad DESC, creado_en DESC
        """, (id_usuario,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        tareas = [{
            "id_tarea": row[0],
            "titulo": row[1],
            "descripcion": row[2],
            "estado": row[3],
            "prioridad": row[4],
            "creado_en": row[5].isoformat() if row[5] else None
        } for row in rows]
        return jsonify(tareas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/tareas', methods=['POST'])
def crear_tarea():
    try:
        data = request.json or {}
        id_usuario = data.get("id_usuario")
        titulo = data.get("titulo")
        descripcion = data.get("descripcion", "")
        prioridad = data.get("prioridad", "Media")

        if not id_usuario or not titulo:
            return jsonify({"error": "id_usuario y titulo son requeridos"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO tareas (id_usuario, titulo, descripcion, estado, prioridad)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id_tarea
        """, (id_usuario, titulo, descripcion, 'Pendiente', prioridad))
        
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"ok": True, "id_tarea": new_id}), 201
    except Exception as e:
        print(f"Error al crear tarea: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/tareas/<int:id_tarea>/completar', methods=['PUT'])
def completar_tarea(id_tarea):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE tareas 
            SET estado = 'Completada', 
                actualizado_en = CURRENT_TIMESTAMP
            WHERE id_tarea = %s
            RETURNING id_tarea
        """, (id_tarea,))
        
        updated = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if updated:
            return jsonify({"ok": True, "message": "Tarea completada"})
        return jsonify({"error": "Tarea no encontrada"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)