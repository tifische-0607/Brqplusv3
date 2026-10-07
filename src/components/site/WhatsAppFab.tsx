import { MessageCircle } from "lucide-react";

// TODO: replace with the live BRQ+ WhatsApp business number.
const WHATSAPP_NUMBER = "60123456789"; // E.164 without "+"
const PREFILLED = "Hello BRQ+, I'd like to discuss a confidential brief.";

export function WhatsAppFab() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILLED)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with BRQ+ on WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 bg-gold text-primary-foreground shadow-[var(--shadow-gold)] transition-transform hover:scale-105 sm:bottom-7 sm:right-7 sm:h-14 sm:w-14"
    >
      <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
    </a>
  );
}
