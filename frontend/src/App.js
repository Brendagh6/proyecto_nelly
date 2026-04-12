import React, { useState, useRef, useEffect } from 'react'; // 1. Añadimos useEffect
import axios from 'axios';

function App() {
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [estadoFatiga, setEstadoFatiga] = useState('Iniciando análisis...'); // 2. Estado para el texto
    const [nivelFatiga, setNivelFatiga] = useState(1); // 3. Estado para el nivel (color)
    const videoRef = useRef(null);

    const handleLogin = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:5000/usuarios');
            const foundUser = res.data.find(u => u.email === email);
            
            if (foundUser) {
                setUser(foundUser);
                startCamera();
            } else {
                alert("Usuario no registrado en ProLife");
            }
        } catch (error) {
            console.error("Error conectando a la API", error);
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            alert("No se pudo acceder a la cámara");
        }
    };

    // --- 4. NUEVA FUNCIÓN: Envía fotos a la API ---
    const analizarCamara = async () => {
        // Solo analizamos si hay un usuario logueado y el video está listo
        if (user && videoRef.current && videoRef.current.readyState === 4) {
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(videoRef.current, 0, 0);
            
            const base64Image = canvas.toDataURL("image/jpeg");

            try {
                const res = await axios.post("http://127.0.0.1:5000/analizar_fatiga", {
                    image: base64Image
                });
                setEstadoFatiga(res.data.estado);
                setNivelFatiga(res.data.nivel);
            } catch (err) {
                console.error("Error al analizar fatiga", err);
            }
        }
    };

    // --- 5. NUEVO EFECTO: Se ejecuta cada 2 segundos ---
    useEffect(() => {
        let interval;
        if (user) {
            interval = setInterval(analizarCamara, 2000);
        }
        return () => clearInterval(interval);
    }, [user]); // Se activa solo cuando el usuario entra

    return (
        <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'Arial' }}>
            {!user ? (
                <div>
                    <h1>ProLife Login</h1>
                    <input 
                        type="email" 
                        placeholder="Tu email" 
                        onChange={(e) => setEmail(e.target.value)} 
                    />
                    <button onClick={handleLogin}>Entrar</button>
                </div>
            ) : (
                <div>
                    <h1>Bienvenido, {user.nombre}</h1>
                    
                    {/* 6. Mostramos el resultado dinámico */}
                    <div style={{ 
                        padding: '15px', 
                        margin: '20px auto', 
                        maxWidth: '500px',
                        borderRadius: '10px',
                        backgroundColor: nivelFatiga === 3 ? '#ffcccc' : nivelFatiga === 2 ? '#fff3cd' : '#d4edda',
                        color: nivelFatiga === 3 ? '#721c24' : nivelFatiga === 2 ? '#856404' : '#155724',
                        fontWeight: 'bold',
                        border: '1px solid'
                    }}>
                        Estado: {estadoFatiga}
                    </div>

                    <video 
                        ref={videoRef} 
                        autoPlay 
                        style={{ width: '100%', maxWidth: '500px', borderRadius: '15px', border: '3px solid #333' }} 
                    />
                    <br /><br />
                    <button onClick={() => window.location.reload()}>Cerrar Sesión</button>
                </div>
            )}
        </div>
    );
}

export default App;