export interface Spot {
  lat: number;
  lng: number;
  category?: 'surf' | 'kitesurf' | 'windsurf' | 'general';
  description?: string;
}

export const ARGENTINA_COAST_SPOTS: Record<string, Spot> = {
  // --- MAR DEL PLATA ---
  // Norte
  "Sun Rider": { lat: -37.9560, lng: -57.5465, category: 'surf' },
  "Estrada": { lat: -37.9660, lng: -57.5435, category: 'surf' },
  "Cardiel": { lat: -37.9790, lng: -57.5405, category: 'surf' },
  
  // La Perla
  "Alfonsina": { lat: -37.9910, lng: -57.5465, category: 'surf' },
  "Saint Michel": { lat: -37.9930, lng: -57.5455, category: 'surf' },
  "San Sebastián": { lat: -37.9950, lng: -57.5445, category: 'surf' },
  "Alicante": { lat: -37.9970, lng: -57.5435, category: 'surf' },
  
  // Centro
  "Playa Popular": { lat: -38.0030, lng: -57.5415, category: 'general' },
  "Punta Iglesia": { lat: -38.0010, lng: -57.5425, category: 'surf' },
  "Cabo Corrientes": { lat: -38.0160, lng: -57.5290, category: 'surf' },
  "Varese": { lat: -38.0130, lng: -57.5315, category: 'surf' },
  
  // Playa Grande
  "Playa Grande (Biología)": { lat: -38.0260, lng: -57.5310, category: 'surf' },
  "Playa Grande (El Yacht)": { lat: -38.0310, lng: -57.5320, category: 'surf' },
  "Playa Grande (Escollera)": { lat: -38.0330, lng: -57.5330, category: 'surf' },
  
  // Punta Mogotes (Complejo)
  "Punta Mogotes (Balneario 1)": { lat: -38.0480, lng: -57.5410, category: 'general' },
  "Punta Mogotes (Balneario 12)": { lat: -38.0600, lng: -57.5430, category: 'general' },
  "Punta Mogotes (Balneario 24)": { lat: -38.0720, lng: -57.5450, category: 'general' },
  
  // Sur (The "Point")
  "Waikiki": { lat: -38.079986, lng: -57.539328, category: 'surf', description: 'Punta sur de Mogotes' },
  "Mariano": { lat: -38.0850, lng: -57.5460, category: 'surf' },
  "Honu Beach": { lat: -38.0880, lng: -57.5480, category: 'surf' },
  "El Faro": { lat: -38.0910, lng: -57.5500, category: 'surf' },
  "La Serena": { lat: -38.0950, lng: -57.5520, category: 'surf' },
  "Acantilados": { lat: -38.1050, lng: -57.5550, category: 'surf' },
  "Luna Roja": { lat: -38.1601, lng: -57.6391, category: 'surf' },
  "Cruz del Sur": { lat: -38.1665, lng: -57.6470, category: 'surf' },
  "RCT": { lat: -38.1765, lng: -57.6570, category: 'general' },
  "Siempre Verde": { lat: -38.1850, lng: -57.6650, category: 'surf' },

  // --- MIRAMAR ---
  "Miramar (El Muelle)": { lat: -38.2760, lng: -57.8265, category: 'surf' },
  "Miramar (Punta Viracho)": { lat: -38.2860, lng: -57.8165, category: 'surf' },
  "Miramar (Pompeya)": { lat: -38.2660, lng: -57.8325, category: 'surf' },
  "Miramar (El Chiringuito)": { lat: -38.2950, lng: -57.8050, category: 'surf' },

  // --- NECOCHEA & QUEQUÉN ---
  "Quequén (Monte Pasubio)": { lat: -38.5715, lng: -58.6745, category: 'surf' },
  "Quequén (La Hélice)": { lat: -38.5775, lng: -58.6845, category: 'surf' },
  "Quequén (Escollera)": { lat: -38.5750, lng: -58.6900, category: 'surf' },
  "Necochea (Escollera)": { lat: -38.5875, lng: -58.7065, category: 'surf' },
  "Necochea (El Caño)": { lat: -38.5935, lng: -58.7145, category: 'surf' },
  "Necochea (Karamawi)": { lat: -38.6015, lng: -58.7245, category: 'surf' },

  // --- COSTA ATLÁNTICA NORTE ---
  "San Clemente (El Muelle)": { lat: -36.3560, lng: -56.6865, category: 'surf' },
  "Santa Teresita": { lat: -36.5410, lng: -56.6865, category: 'general' },
  "San Bernardo": { lat: -36.6860, lng: -56.6765, category: 'general' },
  "Mar de Ajó": { lat: -36.7260, lng: -56.6765, category: 'general' },
  "Pinamar (El Muelle)": { lat: -37.1160, lng: -56.8565, category: 'surf' },
  "Pinamar (UFO Point)": { lat: -37.1060, lng: -56.8465, category: 'surf' },
  "Cariló": { lat: -37.1660, lng: -56.8965, category: 'general' },
  "Villa Gesell": { lat: -37.2560, lng: -56.9665, category: 'surf' },
  "Mar de las Pampas": { lat: -37.3260, lng: -57.0265, category: 'general' },
  "Mar Chiquita": { lat: -37.7560, lng: -57.4265, category: 'kitesurf' },

  // --- PATAGONIA ---
  "Las Grutas": { lat: -40.8160, lng: -65.0965, category: 'general' },
  "Playa Unión": { lat: -43.3260, lng: -65.0365, category: 'surf' },
  "Rio Grande": { lat: -53.7860, lng: -67.7000, category: 'surf' }
};
