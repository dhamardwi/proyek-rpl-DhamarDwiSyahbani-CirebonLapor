"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Perbaiki icon Leaflet default issue di Webpack/Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LocationPickerProps {
  position: [number, number] | null;
  onChange: (pos: [number, number]) => void;
}

function MapEvents({ onChange }: { onChange: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onChange([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function LocationPicker({ position, onChange }: LocationPickerProps) {
  // Cirebon Default Coordinate
  const defaultCenter: [number, number] = [-6.732, 108.5523];
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
    if (map && position) {
      map.flyTo(position, 16);
    }
  }, [position, map]);

  return (
    <div className="h-[300px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner z-0 relative">
      <MapContainer
        center={position || defaultCenter}
        zoom={13}
        className="w-full h-full"
        ref={setMap}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onChange={onChange} />
        {position && <Marker position={position} />}
      </MapContainer>
    </div>
  );
}
