import CrudPage from "@/components/CrudPage";
import { UserCog } from "lucide-react";
import { agentApi } from "@/lib/api";

const Agents = () => <CrudPage title="Agents" icon={UserCog} api={agentApi} module="agents" />;
export default Agents;