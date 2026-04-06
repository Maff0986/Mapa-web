/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { GoogleGenAI } from '@google/genai';

// Mock Data
const MOCK_DEVS = [
  { id: 'd1', name: 'Zensia', zone: 'Temozón Norte', price: 2.5, lat: 21.0500, lng: -89.6000, type: 'dev' },
  { id: 'd2', name: 'Alba', zone: 'Cholul', price: 1.8, lat: 21.0300, lng: -89.5500, type: 'dev' },
  { id: 'd3', name: 'Kante', zone: 'Dzityá', price: 1.5, lat: 21.0400, lng: -89.6500, type: 'dev' },
  { id: 'd4', name: 'Vela', zone: 'Temozón Norte', price: 3.2, lat: 21.0600, lng: -89.6100, type: 'dev' },
];

const INITIAL_POIS = [
  { id: 'p1', name: 'Hospital Faro del Mayab', zone: 'Hospital', lat: 21.0450, lng: -89.6050, type: 'poi', color: '#f59e0b' },
  { id: 'p2', name: 'La Isla Mérida', zone: 'Centro comercial', lat: 21.0550, lng: -89.6150, type: 'poi', color: '#3b82f6' },
  { id: 'p3', name: 'Universidad Anáhuac', zone: 'Educación', lat: 21.0650, lng: -89.6250, type: 'poi', color: '#10b981' },
  { id: 'p4', name: 'Plaza Grande', zone: 'Centro', lat: 20.9674, lng: -89.6225, type: 'poi', color: '#7c3aed' },
];

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [activeZone, setActiveZone] = useState('all');
  const [selectedDev, setSelectedDev] = useState(MOCK_DEVS[0]);
  const [distance, setDistance] = useState<string>('—');
  const [time, setTime] = useState<string>('—');
  const [pois, setPois] = useState<any[]>(INITIAL_POIS);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-89.6225, 20.9674], // Plaza Grande, Mérida
      zoom: 11,
      pitch: 45,
      bearing: -17.6
    });

    map.current.on('load', () => {
      // Add 3D buildings
      if (map.current) {
        map.current.addLayer({
          'id': '3d-buildings',
          'source': 'carto',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#13ecda',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.3
          }
        });
      }
      renderMarkers('all');
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
  };

  const handleMarkerClick = (item: any) => {
    if (item.type === 'dev') {
      setSelectedDev(item);
      const dist = calculateDistance(20.9674, -89.6225, item.lat, item.lng);
      setDistance(dist.toFixed(1) + ' km');
      setTime(Math.round(dist * 2) + ' min'); // Rough estimate
      
      if (map.current) {
        map.current.flyTo({
          center: [item.lng, item.lat],
          zoom: 14,
          pitch: 60,
          essential: true
        });
      }
    }
  };

  const renderMarkers = (filterZone: string, currentPois: any[] = pois) => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const allItems: any[] = [...MOCK_DEVS, ...currentPois];
    
    allItems.forEach(item => {
      if (filterZone !== 'all' && filterZone !== 'poi' && item.zone !== filterZone && item.type !== 'poi') return;
      if (filterZone === 'poi' && item.type !== 'poi') return;

      const el = document.createElement('div');
      el.className = `vx-marker ${item.type === 'poi' ? 'poi' : ''}`.trim();
      
      const inner = document.createElement('div');
      inner.className = 'vx-marker-inner';
      if (item.type === 'poi' && item.color) {
        inner.style.background = item.color;
        inner.style.boxShadow = `0 0 12px ${item.color}80`;
      } else {
        inner.innerHTML = 'V';
      }
      
      const ring = document.createElement('div');
      ring.className = 'vx-marker-ring';
      
      el.appendChild(ring);
      el.appendChild(inner);

      el.addEventListener('click', () => handleMarkerClick(item));

      const popupHtml = `
        <div class="vx-popup ${item.type === 'poi' ? 'poi-popup' : ''}">
          <div class="vx-popup-badge">${item.type === 'dev' ? 'Desarrollo' : item.zone}</div>
          <h4>${item.name}</h4>
          <div class="zona">${item.zone}</div>
          ${item.type === 'dev' ? `<div class="precio">Desde $${item.price}M MXN</div>` : ''}
          <button class="vx-popup-btn">Ver Detalles</button>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
        .setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lng, item.lat])
        .setPopup(popup)
        .addTo(map.current!);
        
      markersRef.current.push(marker);
    });
  };

  const fetchRealPOIs = async () => {
    if (!process.env.GEMINI_API_KEY) {
      alert('GEMINI_API_KEY no está configurada.');
      return;
    }
    
    setIsLoadingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Busca 5 puntos de interés reales e importantes en Mérida, Yucatán, México (como hospitales, centros comerciales, universidades o atracciones turísticas). Devuelve un JSON con un array de objetos. Cada objeto debe tener: 'id' (string único), 'name' (nombre del lugar), 'zone' (tipo de lugar: 'Hospital', 'Centro comercial', 'Educación', 'Atracción', etc.), 'lat' (latitud numérica), 'lng' (longitud numérica). Asegúrate de devolver SOLO el JSON, sin bloques de código markdown.",
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: 20.9674,
                longitude: -89.6225
              }
            }
          }
        }
      });
      
      const text = response.text;
      if (text) {
        try {
          // Extract JSON array or object using regex in case there is text before or after
          const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
          const jsonStr = match ? match[0] : text.replace(/```json\n?|\n?```/g, '').trim();
          
          const parsed = JSON.parse(jsonStr);
          let poisArray = [];
          
          if (Array.isArray(parsed)) {
            poisArray = parsed;
          } else if (parsed && typeof parsed === 'object') {
            // Try to find an array property
            const arrayProp = Object.values(parsed).find(val => Array.isArray(val));
            if (arrayProp) {
              poisArray = arrayProp as any[];
            }
          }
          
          if (poisArray.length > 0) {
            const newPois = poisArray.map((poi: any, index: number) => ({
              ...poi,
              id: poi.id || `ai-poi-${index}`,
              type: 'poi',
              color: poi.zone?.includes('Hospital') ? '#f59e0b' : 
                     poi.zone?.includes('comercial') ? '#3b82f6' : 
                     poi.zone?.includes('Educación') ? '#10b981' : '#7c3aed'
            }));
            setPois(newPois);
            renderMarkers(activeZone, newPois);
          }
        } catch (e) {
          console.error("Failed to parse JSON from AI:", text, e);
          alert("Error al procesar los datos de la IA. Inténtalo de nuevo.");
        }
      }
    } catch (error) {
      console.error("Error fetching POIs with AI:", error);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const filterZone = (zone: string) => {
    setActiveZone(zone);
    renderMarkers(zone);
    if (map.current) {
      map.current.flyTo({
        center: [-89.6225, 20.9674],
        zoom: 11,
        pitch: 45
      });
    }
  };

  const mapReset = () => {
    if (map.current) {
      map.current.flyTo({
        center: [-89.6225, 20.9674],
        zoom: 11,
        pitch: 45,
        bearing: -17.6
      });
    }
  };

  const togglePitch = () => {
    if (map.current) {
      const currentPitch = map.current.getPitch();
      map.current.easeTo({
        pitch: currentPitch > 30 ? 0 : 60
      });
    }
  };

  return (
    <div className="page-mapa-calc min-h-screen">
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[rgba(7,13,12,0.8)] backdrop-blur-md sticky top-0 z-50">
        <a href="#" className="flex items-center gap-2 text-white font-bold text-xl tracking-wider font-['Syne']">
          <span className="material-symbols-outlined text-[var(--cyan)]">location_city</span>
          VEXO <span className="text-[var(--cyan)]">RE</span>
        </a>
        <a href="#" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>Volver al sitio
        </a>
      </nav>

      {/* SECCIÓN MAPA */}
      <section className="mapa-section">
        <div className="mapa-header">
          <span className="label">Mapa interactivo 3D</span>
          <h1>Explora Mérida y sus Desarrollos</h1>
          <p>Todos nuestros proyectos geolocalizados. Pasa el cursor sobre cada pin para ver precios, modelos y distancias a puntos clave.</p>
        </div>

        <div className="map-wrapper">
          <div className="scan-line"></div>
          <div id="mapa-3d" ref={mapContainer}></div>

          {/* HUD */}
          <div className="map-hud">
            <div className="hud-chip"><div className="hud-dot"></div>VEXO Grid · Mérida Online</div>
            <div className="hud-chip" id="hud-devs">{MOCK_DEVS.length} desarrollos · activos</div>
          </div>

          {/* Filtros zona */}
          <div className="map-filters">
            {['all', 'Temozón Norte', 'Cholul', 'Dzityá', 'poi'].map(zone => (
              <button 
                key={zone}
                className={`zone-pill ${activeZone === zone ? 'active' : ''}`} 
                onClick={() => filterZone(zone)}
              >
                {zone === 'all' ? 'Todos' : zone === 'poi' ? 'Puntos de interés' : zone}
              </button>
            ))}
          </div>

          {/* Controles */}
          <div className="map-controls">
            <button className="map-btn" onClick={fetchRealPOIs} title="Actualizar POIs con IA" disabled={isLoadingAI}>
              <span className={`material-symbols-outlined ${isLoadingAI ? 'animate-spin' : ''}`}>
                {isLoadingAI ? 'sync' : 'auto_awesome'}
              </span>
            </button>
            <button className="map-btn" onClick={mapReset} title="Centrar mapa">
              <span className="material-symbols-outlined">my_location</span>
            </button>
            <button className="map-btn" onClick={() => map.current?.zoomIn()} title="Zoom +">
              <span className="material-symbols-outlined">add</span>
            </button>
            <button className="map-btn" onClick={() => map.current?.zoomOut()} title="Zoom -">
              <span className="material-symbols-outlined">remove</span>
            </button>
            <button className="map-btn" onClick={togglePitch} title="Vista 3D/2D">
              <span className="material-symbols-outlined">view_in_ar</span>
            </button>
          </div>

          {/* Leyenda */}
          <div className="map-info-panel">
            <div className="title">Leyenda</div>
            <div className="map-legend-item"><div className="legend-dot" style={{background:'var(--cyan)',boxShadow:'0 0 8px rgba(19,236,218,.5)'}}></div>Desarrollo VEXO</div>
            <div className="map-legend-item"><div className="legend-dot" style={{background:'#7c3aed',boxShadow:'0 0 8px rgba(124,58,237,.4)'}}></div>Punto de interés</div>
            <div className="map-legend-item"><div className="legend-dot" style={{background:'#f59e0b'}}></div>Hospital / Clínica</div>
            <div className="map-legend-item"><div className="legend-dot" style={{background:'#3b82f6'}}></div>Centro comercial</div>
            <div className="map-legend-item"><div className="legend-dot" style={{background:'#10b981'}}></div>Educación</div>
            <div style={{marginTop:'10px',fontSize:'10px',color:'#475569',lineHeight:1.5}}>
              Haz clic en cualquier pin para ver detalles y calcular distancias
            </div>
          </div>
        </div>

        {/* Stats debajo del mapa */}
        <div className="mapa-stats" id="mapa-stats">
          <div className="mapa-stat-card"><div className="val">{MOCK_DEVS.length}</div><div className="lbl">Desarrollos activos</div></div>
          <div className="mapa-stat-card"><div className="val">4</div><div className="lbl">Zonas estratégicas</div></div>
          <div className="mapa-stat-card"><div className="val" id="stat-desde">${Math.min(...MOCK_DEVS.map(d => d.price))}M</div><div className="lbl">Precio desde</div></div>
          <div className="mapa-stat-card"><div className="val">15%</div><div className="lbl">Plusvalía anual prom.</div></div>
          <div className="mapa-stat-card"><div className="val" id="stat-dist">{distance}</div><div className="lbl">Dist. al centro</div></div>
          <div className="mapa-stat-card"><div className="val" id="stat-time">{time}</div><div className="lbl">Tiempo aprox. en auto</div></div>
        </div>
      </section>

      {/* SECCIÓN CALCULADORA */}
      <section className="calc-section mt-12">
        <div className="calc-header">
          <span className="label">Simulador Financiero</span>
          <h2>Calculadora de Inversión</h2>
          <p>Proyecta el rendimiento de tu inversión inmobiliaria en Mérida con datos reales del mercado actual.</p>
        </div>

        <div className="calc-container">
          {/* Panel izquierdo — inputs */}
          <div className="calc-inputs">
            <h3><span className="material-symbols-outlined">tune</span> Configura tu Inversión</h3>
            
            <div className="calc-dev-selector">
              {MOCK_DEVS.map(dev => (
                <div 
                  key={dev.id} 
                  className={`dev-option ${selectedDev.id === dev.id ? 'sel' : ''}`}
                  onClick={() => setSelectedDev(dev)}
                >
                  <div>{dev.name}</div>
                  <div className="dev-precio">Desde ${dev.price}M</div>
                </div>
              ))}
            </div>

            <div className="field">
              <label>Enganche <strong>30%</strong></label>
              <input type="range" min="10" max="90" defaultValue="30" />
            </div>
            
            <div className="field">
              <label>Plazo de financiamiento <strong>12 meses</strong></label>
              <input type="range" min="0" max="36" defaultValue="12" />
            </div>

            <div className="field">
              <label>Esquema de pago</label>
              <select>
                <option>Contado (Descuento 5%)</option>
                <option>Financiamiento Desarrollador</option>
                <option>Crédito Bancario</option>
              </select>
            </div>
          </div>

          {/* Panel derecho — resultados */}
          <div className="calc-results">
            <h3><span className="material-symbols-outlined">monitoring</span> Proyección a 5 años</h3>
            
            <div className="result-grid">
              <div className="result-card">
                <div className="r-label">Valor Propiedad</div>
                <div className="r-val">${selectedDev.price.toFixed(2)}M</div>
                <div className="r-sub">MXN Actual</div>
              </div>
              <div className="result-card highlight">
                <div className="r-label">Valor Proyectado</div>
                <div className="r-val">${(selectedDev.price * Math.pow(1.15, 5)).toFixed(2)}M</div>
                <div className="r-sub">+15% Plusvalía Anual</div>
              </div>
            </div>

            <div className="rate-comparison">
              <div className="rate-row active-rate">
                <div className="rate-name">Plusvalía VEXO</div>
                <div className="rate-bar-bg"><div className="rate-bar" style={{width: '85%', background: 'var(--cyan)'}}></div></div>
                <div className="rate-monto">15.0%</div>
              </div>
              <div className="rate-row">
                <div className="rate-name">Cetes 28 días</div>
                <div className="rate-bar-bg"><div className="rate-bar" style={{width: '60%', background: '#64748b'}}></div></div>
                <div className="rate-monto">11.2%</div>
              </div>
              <div className="rate-row">
                <div className="rate-name">Inflación</div>
                <div className="rate-bar-bg"><div className="rate-bar" style={{width: '30%', background: '#475569'}}></div></div>
                <div className="rate-monto">4.5%</div>
              </div>
            </div>

            <div className="calc-nota">
              <strong>Aviso:</strong> Los cálculos son estimaciones basadas en el comportamiento histórico del mercado inmobiliario en Mérida. No representan una garantía de rendimiento.
            </div>

            <button className="calc-cta">
              Descargar Corrida Financiera <span className="material-symbols-outlined">download</span>
            </button>
          </div>
        </div>
      </section>

      {/* Banner dominio */}
      <div className="domain-banner">
        <span className="material-symbols-outlined">info</span>
        <div>
          <strong>Nota:</strong> Las imágenes de los desarrollos se visualizarán correctamente una vez que el dominio <strong>vexorealestate.com</strong> esté activo y los archivos publicados en Vercel.
          Las rutas locales <code>VEXO_WEB/Desarrollos/...</code> se resolverán automáticamente.
        </div>
      </div>

      <footer className="mini-footer">
        © 2026 VEXO Real Estate. Todos los derechos reservados. <a href="#">Aviso de Privacidad</a>
      </footer>
    </div>
  );
}
