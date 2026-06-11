import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agentApi, type Agent } from "@/lib/api";

interface AgentSelectProps {
  value: string;
  onChange: (agentId: string) => void;
  disabled?: boolean;
}

export function AgentSelect({ value, onChange, disabled }: AgentSelectProps) {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agentApi
      .list()
      .then((list) => setAgents(list.filter((a) => a.status === "active")))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-2">
      <Label>{t("agentsForm.selectAgent")}</Label>
      <Select
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : v)}
        disabled={disabled || loading}
      >
        <SelectTrigger>
          <SelectValue placeholder={t("agentsForm.selectAgentPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("agentsForm.selectAgentPlaceholder")}</SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
              {agent.commissionRate > 0 ? ` (${agent.commissionRate}%)` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
