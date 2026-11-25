import {
  Atom,
  BookOpenText,
  BriefcaseBusiness,
  Calculator,
  Dna,
  Dumbbell,
  FlaskConical,
  Guitar,
  Heart,
  Landmark,
  Languages,
  Leaf,
  Lightbulb,
  MessageCircle,
  Palette,
  PersonStanding,
  Scale,
  ScrollText,
  Shapes,
  TreePine,
  Users,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { AreaId } from "@/types/quiz";

export const ICONOS_AREA: Record<AreaId, LucideIcon> = {
  "identidad-autonomia": Heart,
  convivencia: Users,
  "medio-natural-cultural": TreePine,
  "relaciones-logico-matematicas": Shapes,
  "comprension-expresion-lenguaje": MessageCircle,
  "expresion-artistica": Palette,
  "expresion-corporal": PersonStanding,
  "lengua-literatura": BookOpenText,
  matematica: Calculator,
  "ciencias-naturales": Leaf,
  "estudios-sociales": Landmark,
  ingles: Languages,
  "educacion-fisica": Dumbbell,
  "educacion-cultural-artistica": Guitar,
  fisica: Atom,
  quimica: FlaskConical,
  biologia: Dna,
  historia: ScrollText,
  "educacion-ciudadania": Scale,
  filosofia: Lightbulb,
  "emprendimiento-gestion": BriefcaseBusiness,
};

export default function AreaIcon({ area, ...props }: { area: AreaId } & LucideProps) {
  const Icono = ICONOS_AREA[area];
  return <Icono aria-hidden {...props} />;
}
