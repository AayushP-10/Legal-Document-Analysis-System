import {
  MessageSquare,
  FolderOpen,
  Workflow,
  Clock,
  BookOpen,
  Compass,
  Plus,
  FileText,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const mainNav = [
  { title: "Assistant", url: "/", icon: MessageSquare },
];

const vaultFolders = [
  { title: "Statements", url: "/vault?folder=statements" },
  { title: "Supply Agreements", url: "/vault?folder=supply-agreements" },
];

const bottomNav = [
  { title: "Workflows", url: "/workflows", icon: Workflow },
  { title: "History", url: "/history", icon: Clock },
  { title: "Library", url: "/library", icon: BookOpen },
  { title: "Guidance", url: "/guidance", icon: Compass },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isVaultActive = location.pathname.startsWith("/vault");

  function handleNewChat() {
    navigate("/", { state: { newChat: true } });
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-4">
        {/* New Chat Button */}
        <div className="px-3 mb-4">
          {collapsed ? (
            <Button variant="outline" size="icon" className="w-full" onClick={handleNewChat}>
              <Plus className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" className="w-full justify-start gap-2 font-normal" onClick={handleNewChat}>
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          )}
        </div>

        {/* Assistant */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Vault with nested folders */}
              <Collapsible defaultOpen={isVaultActive}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-sidebar-accent w-full">
                      <FolderOpen className="h-4 w-4" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">Vault</span>
                          <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {vaultFolders.map((folder) => (
                          <SidebarMenuSubItem key={folder.title}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={folder.url}
                                className="hover:bg-sidebar-accent text-muted-foreground"
                                activeClassName="text-sidebar-primary font-medium"
                              >
                                <FileText className="h-3 w-3" />
                                <span>{folder.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>

              {/* Rest of nav */}
              {bottomNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
