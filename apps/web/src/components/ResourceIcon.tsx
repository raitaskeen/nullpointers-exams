"use client";

import {
  AddressBook, Airplane, Archive, Bank, Barbell, Barcode, Bed, Bell, Bicycle, BookOpen, Books, Briefcase, Bug, Buildings,
  Bus, Calendar, CalendarBlank, CalendarCheck, Camera, Car, ChartBar, ChartLineUp, ChatCircle, Clipboard, ClipboardText,
  Clock, Code, Coffee, Coins, CookingPot, CreditCard, Cube, Database, DeviceMobile, Dog, Drop, Envelope, Factory, Files,
  FileText, FirstAidKit, Flag, Folder, ForkKnife, Gear, Globe, GraduationCap, Hammer, Handshake, Heartbeat, Hospital,
  House, IdentificationCard, Image, Invoice, Kanban, Key, Leaf, Lightbulb, Lightning, ListChecks, MapPin, MapTrifold,
  Megaphone, Money, MusicNotes, Newspaper, Note, Package, PaintBrush, PawPrint, Phone, PiggyBank, Pill, Plant, Receipt,
  Recycle, Robot, Rocket, Scales, Shield, ShieldCheck, ShoppingBag, ShoppingCart, Sparkle, Star, Stethoscope, Storefront,
  Student, Sun, Tag, Thermometer, Ticket, Timer, Toolbox, Train, Tree, Trophy, Truck, UserCircle, UserList, Users,
  UsersThree, Video, Wallet, Warehouse, Wrench, type Icon,
} from "@phosphor-icons/react";

/**
 * Curated icon set for resources (one family, one stroke). A resource definition names one of these in
 * `icon` - e.g. icon: "CalendarCheck". Unknown names fall back to Cube. Keep the list domain-generic so
 * any hackathon theme finds a fit without importing the whole library.
 */
export const RESOURCE_ICONS: Record<string, Icon> = {
  AddressBook, Airplane, Archive, Bank, Barbell, Barcode, Bed, Bell, Bicycle, BookOpen, Books, Briefcase, Bug, Buildings,
  Bus, Calendar, CalendarBlank, CalendarCheck, Camera, Car, ChartBar, ChartLineUp, ChatCircle, Clipboard, ClipboardText,
  Clock, Code, Coffee, Coins, CookingPot, CreditCard, Cube, Database, DeviceMobile, Dog, Drop, Envelope, Factory, Files,
  FileText, FirstAidKit, Flag, Folder, ForkKnife, Gear, Globe, GraduationCap, Hammer, Handshake, Heartbeat, Hospital,
  House, IdentificationCard, Image, Invoice, Kanban, Key, Leaf, Lightbulb, Lightning, ListChecks, MapPin, MapTrifold,
  Megaphone, Money, MusicNotes, Newspaper, Note, Package, PaintBrush, PawPrint, Phone, PiggyBank, Pill, Plant, Receipt,
  Recycle, Robot, Rocket, Scales, Shield, ShieldCheck, ShoppingBag, ShoppingCart, Sparkle, Star, Stethoscope, Storefront,
  Student, Sun, Tag, Thermometer, Ticket, Timer, Toolbox, Train, Tree, Trophy, Truck, UserCircle, UserList, Users,
  UsersThree, Video, Wallet, Warehouse, Wrench,
};

export function ResourceIcon({ name, className, weight = "regular" }: { name?: string; className?: string; weight?: "regular" | "duotone" | "fill" | "bold" }) {
  const Cmp = (name && RESOURCE_ICONS[name]) || Cube;
  return <Cmp className={className} weight={weight} aria-hidden="true" />;
}
