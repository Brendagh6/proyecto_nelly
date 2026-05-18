import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import logo from "./logo.png";
import "./App.css";

function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("prolife_user");
    return raw ? JSON.parse(raw) : null;
  });

  const [perfil, setPerfil] = useState(null);
  const [view, setView] = useState("inicio");
  const [recomendacion, setRecomendacion] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [authMode, setAuthMode] = useState("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [estadoFatiga, setEstadoFatiga] = useState("Listo para analizar");
  const [nivelFatiga, setNivelFatiga] = useState(1);
  const [ear, setEar] = useState(null);

  const [historial, setHistorial] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [nuevaTarea, setNuevaTarea] = useState({ titulo: "", descripcion: "", prioridad: "Media" });

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // --- LÓGICA DE USUARIO (Normalización de ID) ---
  const userId = user?.id_usuario || user?.id;

  const nivelUi = useMemo(() => {
    if (nivelFatiga === 3) return { dot: "danger", label: "Alta", emoji: "⚠️" };
    if (nivelFatiga === 2) return { dot: "warn", label: "Media", emoji: "😴" };
    return { dot: "normal", label: "Normal", emoji: "💪" };
  }, [nivelFatiga]);

  useEffect(() => {
    if (nivelFatiga >= 3) {
      setRecomendacion("⚠️ Fatiga alta detectada. Te recomendamos descansar 15-20 minutos...");
    } else if (nivelFatiga === 2) {
      setRecomendacion("😌 Fatiga moderada. Toma un break corto...");
    } else {
      setRecomendacion("💪 ¡Estás en excelente estado! Sigue así...");
    }
  }, [nivelFatiga]);

  // Cargar datos iniciales
  useEffect(() => {
    if (screen === "dashboard" && userId) {
      cargarHistorial();
      cargarTareas();
      fetchPerfil(userId).then(setPerfil).catch(() => {});
    }
  }, [screen, userId]);

  // Recargar tareas al cambiar a esa vista
  useEffect(() => {
    if (view === "tareas" && userId) cargarTareas();
  }, [view]);

  const cargarHistorial = async () => {
    try {
      const res = await api.get(`/historial_fatiga/${userId}`);
      setHistorial(res.data);
    } catch (err) { console.error(err); }
  };

  const cargarTareas = async () => {
    try {
      const res = await api.get(`/tareas/${userId}`);
      setTareas(res.data || []);
    } catch (err) { console.error(err); }
  };

  const marcarTareaCompletada = async (id_tarea) => {
    try {
      await api.put(`/tareas/${id_tarea}/completar`);
      cargarTareas();
    } catch (err) { alert("Error al completar la tarea"); }
  };

  const crearTarea = async () => {
    if (!nuevaTarea.titulo.trim()) return alert("El título es obligatorio");
    try {
      await api.post("/tareas", { ...nuevaTarea, id_usuario: userId });
      setNuevaTarea({ titulo: "", descripcion: "", prioridad: "Media" });
      cargarTareas();
      setSuccessMsg("✅ Tarea creada correctamente");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) { alert("Error al crear la tarea"); }
  };

  // --- CÁMARA ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { console.error("Error cámara:", err); }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const analizarCamara = async () => {
    if (!videoRef.current || !userId) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);
    try {
      const res = await api.post("/analizar_fatiga", {
        id_usuario: userId,
        image: canvas.toDataURL("image/jpeg", 0.85),
      });
      setEstadoFatiga(res.data.estado);
      setNivelFatiga(res.data.nivel);
      setEar(res.data.ear);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    let interval;
    if (screen === "dashboard" && view === "camara") {
      startCamera();
      interval = setInterval(analizarCamara, 1800);
    } else {
      stopCamera();
    }
    return () => {
      if (interval) clearInterval(interval);
      stopCamera();
    };
  }, [screen, view]);

  // --- AUTH ---
  const fetchPerfil = async (id) => {
    const res = await api.get(`/perfil/${id}`);
    return res.data;
  };

  const handleLogin = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.post("/login", { email, password });
      const userData = res.data;
      setUser(userData);
      localStorage.setItem("prolife_user", JSON.stringify(userData));
      try {
        const p = await fetchPerfil(userData.id || userData.id_usuario);
        setPerfil(p);
        setScreen("dashboard");
      } catch { setScreen("onboarding"); }
    } catch { setErrorMsg("Credenciales incorrectas"); }
    setLoading(false);
  };

  const handleRegister = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.post("/register", { nombre, email, password });
      setUser(res.data);
      localStorage.setItem("prolife_user", JSON.stringify(res.data));
      setScreen("onboarding");
    } catch (err) { setErrorMsg(err.response?.data?.error || "Error al registrar"); }
    setLoading(false);
  };

  const handleLogout = () => {
    stopCamera();
    localStorage.removeItem("prolife_user");
    setUser(null);
    setScreen("login");
  };

  return (
    <div className="min-h-screen">
      {screen === "login" && (
       <div className="login-container">
          <div className="login-card">
            {/* LOGO LOGIN: Centrado y más grande */}
            <div className="flex justify-center mb-8">
              <div className="logo-frame-login">
                 <img src={logo} alt="ProLife logo" className="logo-img-login" />
              </div>
            </div>
            <h1>ProLife</h1>
            <p className="text-center subtitle">Tu copiloto de energía y bienestar</p>
            <div className="space-y-5 mt-10">
              {authMode === "register" && <input type="text" placeholder="Nombre completo" className="w-full" onChange={(e) => setNombre(e.target.value)} />}
              <input type="email" placeholder="Correo electrónico" className="w-full" onChange={(e) => setEmail(e.target.value)} />
              <input type="password" placeholder="Contraseña" className="w-full" onChange={(e) => setPassword(e.target.value)} />
              {errorMsg && <p className="text-red-500 text-center">{errorMsg}</p>}
              <button className="btn primary w-full py-4 text-lg" onClick={authMode === "login" ? handleLogin : handleRegister} disabled={loading}>
                {loading ? "Procesando..." : authMode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
              </button>
              <p className="text-center text-sm">
                {authMode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
                <span className="cursor-pointer hover:underline text-violet-500" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
                  {authMode === "login" ? "Regístrate" : "Inicia sesión"}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {screen === "onboarding" && <Onboarding user={user} onComplete={(p) => { setPerfil(p); setScreen("dashboard"); }} />}

      {screen === "dashboard" && (
        <div className="dashboard">
          <div className="sidebar">
            <div className="sidebar-header">
              <div className="brand">
                {/* LOGO SIDEBAR: Un poco más grande */}
                <div className="brand-logo-container">
                  <img src={logo} alt="ProLife" className="brand-logo-img"/>
                </div>
                <div><h1>ProLife</h1><p>Energy Co-pilot</p></div>
              </div>
            </div>
            <div className="sidebar-menu">
              <div className={`menu-item ${view === "inicio" ? "active" : ""}`} onClick={() => setView("inicio")}>🏠 Inicio</div>
              <div className={`menu-item ${view === "camara" ? "active" : ""}`} onClick={() => setView("camara")}>📹 Detección</div>
              <div className={`menu-item ${view === "historial" ? "active" : ""}`} onClick={() => setView("historial")}>📊 Historial</div>
              <div className={`menu-item ${view === "tareas" ? "active" : ""}`} onClick={() => setView("tareas")}>✅ Tareas</div>
              <div className={`menu-item ${view === "perfil" ? "active" : ""}`} onClick={() => setView("perfil")}>👤 Mi Perfil</div>
              <div className={`menu-item ${view === "form" ? "active" : ""}`} onClick={() => setView("form")}>📋 Editar Datos</div>
              <div className={`menu-item ${view === "video" ? "active" : ""}`} onClick={() => setView("video")}>🎥 Video Oficial</div>
            </div>
            <div className="mt-auto p-6"><button onClick={handleLogout} className="btn btn-danger w-full">Cerrar Sesión</button></div>
          </div>

          <div className="main-content">
            {successMsg && <div className="bg-emerald-500 text-white p-4 rounded-lg mb-6 text-center shadow-lg">{successMsg}</div>}
            
            {view === "inicio" && <Inicio user={user} />}
            {view === "camara" && <CamaraView videoRef={videoRef} estadoFatiga={estadoFatiga} nivelUi={nivelUi} ear={ear} recomendacion={recomendacion} />}
            {view === "historial" && <HistorialView historial={historial} />}
            {view === "tareas" && <TareasView tareas={tareas} onCompletar={marcarTareaCompletada} nuevaTarea={nuevaTarea} setNuevaTarea={setNuevaTarea} crearTarea={crearTarea} />}
            {view === "perfil" && <PerfilView perfil={perfil} />}
            {view === "form" && (
              <Onboarding 
                user={user} 
                perfilActual={perfil} 
                isEdit={true} 
                onComplete={(p) => { 
                  setPerfil(p); 
                  setSuccessMsg("✅ Datos actualizados correctamente"); 
                  setTimeout(() => setSuccessMsg(""), 3000); 
                  setView("perfil");
                }} 
              />
            )}
            {view === "video" && <PromoVideo />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================== SUBCOMPONENTES ====================== */

function Inicio({ user }) {
  return (
    <div className="animate-in">
      <h2 className="card-title">¡Hola, {user?.nombre}! 👋</h2>
      <p className="subtitle mb-8">Estado del sistema: <span className="text-emerald-500 font-bold">Óptimo</span></p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card"><h3>💧 Hidratación</h3><p className="text-sm">Bebe agua en la próxima hora.</p></div>
        <div className="card"><h3>🧘 Pausa Activa</h3><p className="text-sm">Estira cada 45 minutos.</p></div>
        <div className="card"><h3>🧠 Enfoque</h3><p className="text-sm">Nivel de fatiga actual: Bajo.</p></div>
      </div>
    </div>
  );
}

function CamaraView({ videoRef, estadoFatiga, nivelUi, ear, recomendacion }) {
  return (
    <div className="animate-in">
      <h2 className="card-title">📹 Copiloto de Energía</h2>
      <div className="video-container shadow-2xl rounded-3xl overflow-hidden relative">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="status-overlay">
          <span className={`dot ${nivelUi.dot}`}></span>
          <div>
            <p style={{ margin: 0, fontSize: "14px" }}>Estado: {estadoFatiga}</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "bold" }}>Nivel {nivelUi.label}</p>
          </div>
        </div>
      </div>
      <div className="card mt-6"><p style={{ fontSize: "1.2rem" }}>{recomendacion}</p></div>
    </div>
  );
}

function HistorialView({ historial }) {
  return (
    <div>
      <h2 className="card-title">📊 Historial de Fatiga</h2>
      <div className="grid gap-3">
        {historial.length === 0 ? <p className="opacity-50">No hay registros.</p> : 
          historial.map((item, i) => (
            <div key={i} className="card flex justify-between">
              <div><span className="font-semibold">{item.estado}</span><br/><small>EAR: {item.ear}</small></div>
              <div className="text-right text-sm opacity-60">{new Date(item.fecha).toLocaleString()}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function TareasView({ tareas, onCompletar, nuevaTarea, setNuevaTarea, crearTarea }) {
  return (
    <div>
      <h2 className="card-title">✅ Gestión de Tareas</h2>
      <div className="card mb-6 shadow-md">
        <h3 className="mb-4">Asignar Nueva Tarea</h3>
        <input type="text" placeholder="¿Qué hay que hacer?" className="w-full mb-3" value={nuevaTarea.titulo} onChange={(e) => setNuevaTarea({...nuevaTarea, titulo: e.target.value})} />
        <input type="text" placeholder="Detalles adicionales..." className="w-full mb-3" value={nuevaTarea.descripcion} onChange={(e) => setNuevaTarea({...nuevaTarea, descripcion: e.target.value})} />
        <div className="flex gap-4 mb-4">
            <select className="flex-1" value={nuevaTarea.prioridad} onChange={e => setNuevaTarea({...nuevaTarea, prioridad: e.target.value})}>
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
            </select>
            <button onClick={crearTarea} className="btn primary px-8">Guardar</button>
        </div>
      </div>
      <div className="grid gap-3">
        {tareas.length === 0 ? <p className="text-center p-10 opacity-50">No hay tareas pendientes</p> : 
          tareas.map(t => (
            <div key={t.id_tarea} className={`card flex justify-between items-center border-l-4 ${t.prioridad === 'Alta' ? 'border-red-500' : 'border-emerald-500'}`}>
              <div>
                <p className={`font-bold ${t.estado === "Completada" ? "line-through opacity-50" : ""}`}>{t.titulo}</p>
                <p className="text-sm opacity-70">{t.descripcion}</p>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">{t.prioridad}</span>
              </div>
              <button onClick={() => onCompletar(t.id_tarea)} className={`btn ${t.estado === "Completada" ? "btn-disabled" : "primary"}`} disabled={t.estado === "Completada"}>
                {t.estado === "Completada" ? "✓ Hecho" : "Completar"}
              </button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function PerfilView({ perfil }) {
  return (
    <div className="card">
      <h2 className="card-title">👤 Perfil de Usuario</h2>
      <div className="space-y-4">
        <p><strong>Trabajo:</strong> {perfil?.tipo_trabajo || "No definido"}</p>
        <p><strong>Área:</strong> {perfil?.area || "No definida"}</p>
        <p><strong>Turno:</strong> {perfil?.turno || "No definido"}</p>
      </div>
    </div>
  );
}

function Onboarding({ user, onComplete, isEdit = false, perfilActual = null }) {
  const [form, setForm] = useState({
    tipo_trabajo: perfilActual?.tipo_trabajo || "",
    area: perfilActual?.area || "",
    turno: perfilActual?.turno || "Diurno",
  });

  const handleSubmit = async () => {
    try {
      await api.post("/perfil", { id_usuario: user.id || user.id_usuario, ...form });
      const updated = (await api.get(`/perfil/${user.id || user.id_usuario}`)).data;
      onComplete(updated);
    } catch (err) { alert("Error al guardar perfil"); }
  };

  return (
    <div className="card max-w-lg mx-auto">
      <h2 className="card-title">{isEdit ? "⚙️ Editar Datos" : `¡Bienvenido!`}</h2>
      <div className="space-y-4">
        <input placeholder="Puesto" className="w-full" value={form.tipo_trabajo} onChange={e => setForm({...form, tipo_trabajo: e.target.value})} />
        <input placeholder="Área" className="w-full" value={form.area} onChange={e => setForm({...form, area: e.target.value})} />
        <select className="w-full" value={form.turno} onChange={e => setForm({...form, turno: e.target.value})}>
          <option value="Diurno">Diurno</option>
          <option value="Nocturno">Nocturno</option>
          <option value="Mixto">Mixto</option>
        </select>
        <button className="btn primary w-full" onClick={handleSubmit}>{isEdit ? "Actualizar" : "Comenzar"}</button>
      </div>
    </div>
  );
}

function PromoVideo() {
  const recordVideo = async () => {
    const container = document.getElementById('canvas-container');
    const startBtn = document.getElementById('startBtn');
    const slides = document.querySelectorAll('.slide');
    if (!container || !startBtn) return;
    startBtn.disabled = true;
    startBtn.innerText = "GRABANDO...";
    try {
      const stream = container.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "ProLife_Promo.mp4";
        a.click();
        startBtn.innerText = "¡DESCARGADO!";
      };
      recorder.start();
      let current = 0;
      const sequence = () => {
        if (current < slides.length - 1) {
          setTimeout(() => {
            slides[current].classList.remove('active');
            current++;
            slides[current].classList.add('active');
            sequence();
          }, 3000);
        } else { setTimeout(() => recorder.stop(), 3000); }
      };
      sequence();
    } catch (err) { alert("Error al grabar"); startBtn.disabled = false; }
  };

  return (
    <div className="text-center">
      <h2 className="card-title">🎥 Video Oficial</h2>
      <div id="canvas-container" style={{ width: "800px", height: "450px", margin: "0 auto", position: "relative", overflow: "hidden", borderRadius: "15px" }}>
        <div className="slide active">
          <h1 className="text-4xl font-bold">PROLIFE</h1>
          <p>Tu salud, nuestra prioridad</p>
        </div>
        <div className="slide">
          <h2 className="text-3xl">IA Antifatiga</h2>
          <p>Monitoreo en tiempo real</p>
        </div>
        <div className="slide">
          <h2 className="text-3xl">Optimiza tu energía</h2>
          <p>prolife.tech | 2026</p>
        </div>
      </div>
      <button id="startBtn" onClick={recordVideo} className="btn primary mt-6">GRABAR Y DESCARGAR PROMO</button>
    </div>
  );
}

export default App;