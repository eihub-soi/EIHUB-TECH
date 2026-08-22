import {
  ComponentItem,
  Profile,
  BorrowRequest,
  NotificationItem,
} from "../types";

const now = new Date();

// Helper to get ISO string offset by days/hours/minutes relative to current execution time
function offsetDate(
  days: number,
  hours: number = 0,
  minutes: number = 0,
): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export const INITIAL_PROFILES: Profile[] = [
  {
    id: "usr-faculty-01",
    email: "faculty-01@kgkite.ac.in",
    full_name: "Faculty User 01",
    role: "faculty",
    faculty_id: "FAC-KITE-01",
    department: "ECE",
    phone: "+91 98765 00001",
    avatar_url: "/avatars/faculty.png",
    is_active: true,
    created_at: offsetDate(-15),
    updated_at: offsetDate(-15),
  },
  {
    id: "usr-admin-02",
    email: "admin-02@kgkite.ac.in",
    full_name: "Admin User 02",
    role: "admin",
    department: "ECE / School of Innovation",
    phone: "+91 98765 00002",
    avatar_url: "/avatars/admin.png",
    is_active: true,
    created_at: offsetDate(-15),
    updated_at: offsetDate(-15),
  },
];

export const INITIAL_COMPONENTS: ComponentItem[] = [
  {
    id: "comp-1",
    sku: "MCU-ARD-001",
    name: "Arduino Uno R3",
    category: "Microcontrollers",
    description:
      "ATmega328P based microcontroller development board with 14 digital I/O pins and 6 analog inputs.",
    total_stock: 25,
    available_stock: 25,
    borrowed_stock: 0,
    cabinet: "Lab A, Cabinet 3",
    shelf: "Shelf 2",
    location_details: "Lab A - Microcontroller Rack",
    image_url:
      "https://images.unsplash.com/photo-1608564697071-ddf911d81370?w=400&auto=format&fit=crop&q=80",
    unit_cost: 18.5,
    created_at: offsetDate(-60),
    updated_at: offsetDate(-10),
  },
  {
    id: "comp-2",
    sku: "MCU-ESP-002",
    name: "ESP32 Dev Module",
    category: "Microcontrollers",
    description:
      "Dual-core Wi-Fi & Bluetooth microcontroller board with ultra-low power co-processor.",
    total_stock: 18,
    available_stock: 18,
    borrowed_stock: 0,
    cabinet: "Lab A, Cabinet 3",
    shelf: "Shelf 2",
    location_details: "Lab A - IoT Tray",
    image_url:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=80",
    unit_cost: 9.75,
    created_at: offsetDate(-60),
    updated_at: offsetDate(-10),
  },
  {
    id: "comp-3",
    sku: "SEN-ULR-004",
    name: "Ultrasonic Sensor HC-SR04",
    category: "Sensors",
    description:
      "Ultrasonic ranging module provides 2cm - 400cm non-contact measurement function with range accuracy up to 3mm.",
    total_stock: 40,
    available_stock: 40,
    borrowed_stock: 0,
    cabinet: "Lab A, Cabinet 4",
    shelf: "Shelf 1",
    location_details: "Lab A - Sensors Drawer",
    image_url:
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&auto=format&fit=crop&q=80",
    unit_cost: 3.2,
    created_at: offsetDate(-50),
    updated_at: offsetDate(-10),
  },
  {
    id: "comp-4",
    sku: "SEN-PIR-008",
    name: "PIR Motion Sensor HC-SR501",
    category: "Sensors",
    description:
      "Pyroelectric infrared sensor detects motion based on changes in infrared radiation levels.",
    total_stock: 15,
    available_stock: 15,
    borrowed_stock: 0,
    cabinet: "Lab A, Cabinet 4",
    shelf: "Shelf 1",
    location_details: "Lab A - Sensors Drawer",
    image_url:
      "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&auto=format&fit=crop&q=80",
    unit_cost: 2.9,
    created_at: offsetDate(-50),
    updated_at: offsetDate(-10),
  },
  {
    id: "comp-5",
    sku: "PAS-JMP-100",
    name: "Jumper Wires (100pcs)",
    category: "Passive",
    description:
      "Male to Female breadboard prototyping ribbon wires 20cm length.",
    total_stock: 166,
    available_stock: 166,
    borrowed_stock: 0,
    cabinet: "Lab A, Cabinet 1",
    shelf: "Shelf 1",
    location_details: "Lab A - Consumables Drawer",
    image_url:
      "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=400&auto=format&fit=crop&q=80",
    unit_cost: 4.5,
    created_at: offsetDate(-40),
    updated_at: offsetDate(-10),
  },
  {
    id: "comp-6",
    sku: "MOD-REL-002",
    name: "5V Relay Module (2-Channel)",
    category: "Modules",
    description:
      "Optocoupler isolation 250V AC / 30V DC relay control board for switching heavy loads.",
    total_stock: 25,
    available_stock: 25,
    borrowed_stock: 0,
    cabinet: "Lab A, Cabinet 2",
    shelf: "Shelf 3",
    location_details: "Lab A - Power Modules",
    image_url:
      "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=400&auto=format&fit=crop&q=80",
    unit_cost: 5.8,
    created_at: offsetDate(-30),
    updated_at: offsetDate(-10),
  },
  {
    id: "comp-7",
    sku: "MOD-SER-009",
    name: "SG90 Micro Servo Motor 9g",
    category: "Modules",
    description:
      "Lightweight high torque servo motor 180 degree rotation for robotics prototyping.",
    total_stock: 50,
    available_stock: 50,
    borrowed_stock: 0,
    cabinet: "Lab A, Cabinet 4",
    shelf: "Shelf 1",
    location_details: "Lab A - Actuators Rack",
    image_url:
      "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400&auto=format&fit=crop&q=80",
    unit_cost: 3.9,
    created_at: offsetDate(-30),
    updated_at: offsetDate(-10),
  },
  {
    id: "comp-8",
    sku: "SEN-DHT-022",
    name: "DHT22 Temperature & Humidity Sensor",
    category: "Sensors",
    description:
      "Capacitive digital humidity and calibrated temperature sensor module.",
    total_stock: 12,
    available_stock: 12,
    borrowed_stock: 0,
    cabinet: "Lab B",
    shelf: "Box 5",
    location_details: "Lab B - Environmental Sensors",
    image_url:
      "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=400&auto=format&fit=crop&q=80",
    unit_cost: 7.4,
    created_at: offsetDate(-20),
    updated_at: offsetDate(-10),
  },
];

export const INITIAL_REQUESTS: BorrowRequest[] = [];


export const INITIAL_PURCHASE_ORDERS: any[] = [];
