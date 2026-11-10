import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { circle, circleMarker, icon, layerGroup, map, marker, tileLayer } from 'leaflet';
import markerUrl from 'leaflet/dist/images/marker-icon.png';
import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { bboxFromBounds, pointToLatLng } from './paradas.js';

const initialCenter = [-6.8863, -38.5559];
const initialZoom = 14;
const maxAge = 30_000;
const locationErrors = {
  1: 'Permissão de geolocalização negada.',
  2: 'A localização está indisponível.',
  3: 'O tempo de espera pela localização terminou.',
};
const stopIcon = icon({
  iconUrl: markerUrl,
  iconRetinaUrl: markerRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});
const draftIcon = icon({
  iconUrl: markerUrl,
  iconRetinaUrl: markerRetinaUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'draft-pin',
});

export default function MapView({ stops, draft, center, onBounds, onPoint, onEdit, onLocation, userPosition, radius }) {
  const container = useRef(null);
  const mapView = useRef(null);
  const layers = useRef(null);
  const callbacks = useRef({ onBounds, onPoint, onLocation });
  const [locationStatus, setLocationStatus] = useState('Buscando sua localização…');

  useLayoutEffect(() => {
    callbacks.current = { onBounds, onPoint, onLocation };
  });

  useEffect(() => {
    const view = map(container.current, { worldCopyJump: true }).setView(initialCenter, initialZoom);
    mapView.current = view;
    view.attributionControl.setPrefix(false);
    tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    }).addTo(view);

    layers.current = {
      view,
      stops: layerGroup().addTo(view),
      draft: layerGroup().addTo(view),
      radius: layerGroup().addTo(view),
    };
    const reportBounds = () => callbacks.current.onBounds(bboxFromBounds(view.getBounds()));
    const selectPoint = ({ latlng }) => callbacks.current.onPoint([latlng.lat, latlng.wrap().lng]);
    view.on('moveend', reportBounds);
    view.on('click', selectPoint);
    reportBounds();

    let active = true;
    function fail(message) {
      if (!active) return;
      setLocationStatus(`${message} O filtro por raio está indisponível. A localização padrão do mapa é Cajazeiras-PB.`);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
        if (!active) return;
        if (Date.now() - timestamp > maxAge) {
          fail('A localização recebida expirou.');
          return;
        }
        const point = [coords.latitude, coords.longitude];
        circleMarker(point, { radius: 9, color: '#fff', fillColor: '#0759b5', fillOpacity: 1 })
          .bindTooltip('Sua localização').addTo(view);
        callbacks.current.onLocation({ lat: coords.latitude, lng: coords.longitude });
        if (layers.current.centeredOnResult) {
          setLocationStatus('Sua localização está marcada no mapa.');
        } else {
          view.setView(point, initialZoom);
          setLocationStatus('Mapa centralizado na sua localização.');
        }
      }, ({ code }) => fail(locationErrors[code] ?? locationErrors[2]), {
        maximumAge: maxAge,
        timeout: 10_000,
      });
    } else {
      fail(locationErrors[2]);
    }

    return () => {
      active = false;
      view.remove();
    };
  }, []);

  useEffect(() => {
    const layer = layers.current.radius;
    layer.clearLayers();
    if (userPosition && radius !== null) {
      const { lat, lng } = userPosition;
      const area = circle([lat, lng], { radius, interactive: false }).addTo(layer);
      mapView.current.fitBounds(area.getBounds(), { padding: [16, 16], animate: false });
    }
  }, [userPosition, radius]);

  useEffect(() => {
    if (!center) return;
    const { view } = layers.current;
    layers.current.centeredOnResult = true;
    view.setView(center, Math.max(view.getZoom(), initialZoom));
  }, [center]);

  useEffect(() => {
    const layer = layers.current.stops;
    layer.clearLayers();
    for (const stop of stops) {
      const label = document.createElement('span');
      label.textContent = stop.nome;
      marker(pointToLatLng(stop.localizacao), { icon: stopIcon, alt: stop.nome })
        .bindTooltip(label)
        .on('click', () => onEdit(stop))
        .addTo(layer);
    }
  }, [stops, onEdit]);

  useEffect(() => {
    const layer = layers.current.draft;
    layer.clearLayers();
    if (draft) {
      marker(draft, { icon: draftIcon, alt: 'Ponto em edição', draggable: true, zIndexOffset: 1000 })
        .on('dragend', ({ target }) => {
          const { lat, lng } = target.getLatLng().wrap();
          onPoint([lat, lng]);
        })
        .addTo(layer);
    }
  }, [draft, onPoint]);

  return (
    <section aria-label="Mapa de transporte universitário">
      <div className="map" ref={container} role="region" aria-label="Mapa interativo" />
      <p role="status">{locationStatus}</p>
      <p>● Sua localização · Azul: parada salva · Laranja: ponto em edição</p>
    </section>
  );
}
