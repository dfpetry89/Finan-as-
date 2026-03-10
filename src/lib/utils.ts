import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Transaction {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  description: string;
  payment_method?: "PIX" | "Dinheiro" | "Cartão";
  users: string[];
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
}

export interface Category {
  id: string;
  type: "income" | "expense";
  name: string;
}

export const CATEGORIES = {
  income: [
    "Salário",
    "Freelance",
    "Investimentos",
    "Presente",
    "Outros",
  ],
  expense: [
    "Alimentação",
    "Moradia",
    "Transporte",
    "Lazer",
    "Saúde",
    "Educação",
    "Compras",
    "Assinaturas",
    "Outros",
  ],
};
