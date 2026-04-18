import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";

import DashboardPage from "./pages/DashboardPage";
import LeadGenerationPage from "./pages/LeadGenerationPage";
import MetaFormsPage from "./pages/MetaFormsPage";
import CustomFormsPage from "./pages/CustomFormsPage";
import CustomFormDetailPage from "./pages/CustomFormDetailPage";
import LandingPagesPage from "./pages/LandingPagesPage";
import LandingPageBuilderPage from "./pages/LandingPageBuilderPage";
import WhatsAppSetupPage from "./pages/WhatsAppSetupPage";
import LeadManagementOverviewPage from "./pages/LeadManagementOverviewPage";
import LeadsPage from "./pages/LeadsPage";
import ContactsPage from "./pages/ContactsPage";
import ContactGroupPage from "./pages/ContactGroupPage";
import AutomationOverviewPage from "./pages/AutomationOverviewPage";
import AutomationPage from "./pages/AutomationPage";
import AutomationTemplatesPage from "./pages/AutomationTemplatesPage";
import WhatsAppAutomationPage from "./pages/WhatsAppAutomationPage";
import WorkflowEditorPage from "./pages/WorkflowEditorPage";
import InboxPage from "./pages/InboxPage";
import FieldsPage from "./pages/FieldsPage";
import CalendarPage from "./pages/CalendarPage";
import CalendarEditPage from "./pages/CalendarEditPage";
import StaffPage from "./pages/StaffPage";
import SettingsPage from "./pages/SettingsPage";
import CompanyDetailsPage from "./pages/CompanyDetailsPage";
import NotificationsPage from "./pages/NotificationsPage";
import AssignmentRulesPage from "./pages/AssignmentRulesPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import LoginPage from "./pages/LoginPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import CreateBusinessPage from "./pages/CreateBusinessPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* App routes */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Lead Generation */}
            <Route path="/lead-generation" element={<LeadGenerationPage />} />
            <Route path="/lead-generation/meta-forms" element={<MetaFormsPage />} />
            <Route path="/lead-generation/custom-forms" element={<CustomFormsPage />} />
            <Route path="/lead-generation/custom-forms/:id" element={<CustomFormDetailPage />} />
            <Route path="/lead-generation/landing-pages" element={<LandingPagesPage />} />
            <Route path="/lead-generation/whatsapp" element={<WhatsAppSetupPage />} />

            {/* Lead Management */}
            <Route path="/lead-management" element={<LeadManagementOverviewPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/lead-management/contacts" element={<ContactsPage />} />
            <Route path="/lead-management/contact-groups" element={<ContactGroupPage />} />

            {/* Automation */}
            <Route path="/automation" element={<AutomationOverviewPage />} />
            <Route path="/automation/workflows" element={<AutomationPage />} />
            <Route path="/automation/templates" element={<AutomationTemplatesPage />} />
            <Route path="/automation/whatsapp" element={<WhatsAppAutomationPage />} />

            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/fields" element={<FieldsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/calendar/edit/:id" element={<CalendarEditPage />} />
            <Route path="/staff" element={<StaffPage />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/company" element={<CompanyDetailsPage />} />
            <Route path="/settings/notifications" element={<NotificationsPage />} />
            <Route path="/settings/assignment-rules" element={<AssignmentRulesPage />} />
            <Route path="/settings/integrations" element={<IntegrationsPage />} />

            {/* Super Admin */}
            <Route path="/admin" element={<SuperAdminPage />} />
            <Route path="/admin/create" element={<CreateBusinessPage />} />
          </Route>

          {/* Full-screen editors — outside AppLayout */}
          <Route path="/automation/editor/:id" element={<WorkflowEditorPage />} />
          <Route path="/lead-generation/landing-pages/builder" element={<LandingPageBuilderPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
