import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Transaction {
  id: number;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  description: string;
  created_at: string;
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
