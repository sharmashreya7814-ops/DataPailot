import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  Package,
  Activity,
  X,
  Sparkles,
  ArrowRight,
  Database,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { DASHBOARD_TEMPLATES, TemplateDefinition, DashboardTemplateService } from '../../services/dashboardTemplateService';
import { DashboardService } from '../../services/dashboardService';
import { DiscoveredTable } from '../../types/database';
import { Dashboard } from '../../types/dashboard';

interface DashboardTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  discoveredTables: DiscoveredTable[];
  onSelectTemplate: (dashboard: Dashboard) => void;
}

export const DashboardTemplatesModal: React.FC<DashboardTemplatesModalProps> = ({
  isOpen,
  onClose,
  discoveredTables,
  onSelectTemplate
}) => {
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const getIcon = (icon: string) => {
    switch (icon) {
      case 'TrendingUp':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case 'Users':
        return <Users className="w-5 h-5 text-indigo-400" />;
      case 'Package':
        return <Package className="w-5 h-5 text-amber-400" />;
      case 'Activity':
        return <Activity className="w-5 h-5 text-cyan-400" />;
      default:
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
    }
  };

  const handleApply = async (template: TemplateDefinition) => {
    if (applyingTemplateId) return; // Prevent duplicate clicks
    setErrorMessage(null);
    setApplyingTemplateId(template.id);

    try {
      const dashboard = DashboardTemplateService.instantiateTemplate(
        template.id,
        discoveredTables
      );

      if (!dashboard || !dashboard.id) {
        throw new Error(`Failed to generate dashboard configuration for ${template.name}.`);
      }

      // Persist the dashboard using the existing DashboardService
      const saved = DashboardService.saveDashboard(dashboard);
      onSelectTemplate(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to apply starter template:', err);
      setErrorMessage(err?.message || 'Failed to apply template. Please try again.');
    } finally {
      setApplyingTemplateId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Starter Dashboard Templates</h3>
              <p className="text-xs text-slate-400">
                Pre-configured layouts ready to map to your live database tables
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center space-x-2 animate-in fade-in duration-100">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Templates Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {DASHBOARD_TEMPLATES.map(tmpl => {
            // Check how many suggested tables match current discovered schema
            const matchedKeywords = tmpl.widgets.flatMap(w => w.suggestedTableKeywords);
            const matchingTables = discoveredTables.filter(t =>
              matchedKeywords.some(kw => t.name.toLowerCase().includes(kw))
            );

            const isThisApplying = applyingTemplateId === tmpl.id;
            const isAnyApplying = Boolean(applyingTemplateId);

            return (
              <div
                key={tmpl.id}
                className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-indigo-950/20"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center justify-center">
                        {getIcon(tmpl.icon)}
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold tracking-wider text-indigo-400 uppercase">
                          {tmpl.category}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-100 group-hover:text-white">
                          {tmpl.name}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    {tmpl.description}
                  </p>

                  <div className="space-y-1.5 mb-4 border-t border-slate-800/80 pt-3">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                      Included Widgets ({tmpl.widgets.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {tmpl.widgets.map((w, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          {w.title}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                    <Database className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {matchingTables.length > 0
                        ? `${matchingTables.length} tables found`
                        : 'Requires schema mapping'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApply(tmpl)}
                    disabled={isAnyApplying}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors shadow-lg shadow-indigo-950 ${
                      isThisApplying
                        ? 'bg-indigo-700 cursor-wait'
                        : isAnyApplying
                        ? 'bg-indigo-600/40 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    {isThisApplying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Applying Template...</span>
                      </>
                    ) : (
                      <>
                        <span>Use Template</span>
                        <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span>
            Templates never invent synthetic data. If fields differ from your database, widgets will prompt for schema mapping.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
