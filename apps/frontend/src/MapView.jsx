import { useEffect, useRef } from 'react';
import { map, tileLayer } from 'leaflet';

export default function MapView() {
  const container = useRef(null);

  useEffect(() => {
    const view = map(container.current).setView([-6.8863, -38.5559], 14);
    view.attributionControl.setPrefix(false);
    tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    }).addTo(view);

    return () => view.remove();
  }, []);

  return <div className="map" ref={container} role="region" aria-label="Mapa de transporte universitário" />;
}
