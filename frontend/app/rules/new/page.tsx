import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RuleForm } from "@/components/RuleForm";

export default function NewRulePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">New Rule</h1>
      </div>
      <RuleForm />
    </div>
  );
}
