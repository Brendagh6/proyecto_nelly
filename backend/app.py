import cv2
import mediapipe as mp
import numpy as np
import base64
import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- CONFIGURACIÓN DE BASE DE DATOS ---
def get_db_connection():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASS')
    )
    return conn

# --- CONFIGURACIÓN DE MEDIAPIPE ---
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False, 
    max_num_faces=1, 
    refine_landmarks=True
)

# Índices de los ojos
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

# --- RUTAS ---

@app.route('/')
def index():
    return "ProLife API: Energy Co-pilot is Running! 🦊⚡"

@app.route('/usuarios', methods=['GET'])
def get_usuarios():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT id_usuario, nombre, email FROM usuarios;')
        usuarios = cur.fetchall()
        cur.close()
        conn.close()
        
        lista_usuarios = []
        for u in usuarios:
            lista_usuarios.append({"id": u[0], "nombre": u[1], "email": u[2]})
        
        return jsonify(lista_usuarios)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analizar_fatiga', methods=['POST'])
def analizar_fatiga():
    try:
        data = request.json
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

        return jsonify({
            "estado": estado,
            "ear": round(ear_promedio, 3),
            "nivel": nivel
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)