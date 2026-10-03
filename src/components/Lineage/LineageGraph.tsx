import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background, 
  Controls, 
  MiniMap, 
  Node, 
  Edge,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DiscoveredTable, DatabaseRelationship } from '../../types/database';
import { Database, Layers } from 'lucide-react';

const TableNode = ({ data, selected }: any) => {
  return (
    <div
      className={`rounded-xl border transition-all duration-200 min-w-[210px] shadow-xl overflow-hidden ${
        selected
          ? 'bg-slate-900 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-500/60'
          : 'bg-slate-900/95 border-slate-700/80 hover:border-slate-500 hover:shadow-2xl'
      }`}
    >
      {/* Node Header */}
      <div
        className={`px-3.5 py-2.5 flex items-center justify-between border-b transition-colors ${
          selected
            ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-200'
            : 'bg-slate-800/90 border-slate-700/80 text-white'
        }`}
      >
        <div className="flex items-center space-x-2 truncate min-w-0">
          <Database className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? 'text-cyan-400' : 'text-indigo-400'}`} />
          <div className="text-xs font-bold truncate tracking-tight font-mono">{data.label}</div>
        </div>
      </div>

      {/* Node Body with Clearly Visible Schema & Accurate Row Count */}
      <div className="p-2.5 space-y-1.5 text-xs bg-slate-950/80">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Schema</span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-cyan-300 border border-slate-800 font-semibold truncate max-w-[130px]">
            {data.schema || 'public'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
          <div className="flex items-center space-x-1.5">
            <Layers className="w-3 h-3 text-slate-500" />
            <span className="text-slate-200 font-medium">
              {data.rowCount !== undefined ? `${Number(data.rowCount).toLocaleString()} rows` : '0 rows'}
            </span>
          </div>
          <span className={`w-2 h-2 rounded-full ${selected ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400/80'}`} />
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-cyan-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-cyan-500 !border-2 !border-slate-900" />
    </div>
  );
};

const nodeTypes = {
  tableNode: TableNode
};

interface LineageGraphProps {
  tables: DiscoveredTable[];
  relationships: DatabaseRelationship[];
  selectedNode: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export const LineageGraph: React.FC<LineageGraphProps> = ({ tables, relationships, selectedNode, onSelectNode }) => {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Grid layout calculation with generous spacing to prevent overlap
    const cols = Math.max(1, Math.ceil(Math.sqrt(tables.length * 1.5)));
    
    tables.forEach((t, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      
      nodes.push({
        id: `${t.schema}.${t.name}`,
        type: 'tableNode',
        position: { x: col * 300, y: row * 180 },
        data: { 
          label: t.name,
          schema: t.schema,
          rowCount: t.approximateRowCount ?? 0
        }
      });
    });
    
    relationships.forEach((r, i) => {
      const sourceId = `${r.sourceSchema}.${r.sourceTable}`;
      const targetId = `${r.targetSchema}.${r.targetTable}`;
      
      edges.push({
        id: `e-${sourceId}-${targetId}-${i}`,
        source: sourceId,
        target: targetId,
        label: `${r.sourceColumn} → ${r.targetColumn}`,
        labelStyle: { fill: '#cbd5e1', fontSize: 10, fontWeight: 600, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#090d16', stroke: '#334155', strokeWidth: 1, rx: 6, ry: 6 },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 6,
        animated: true,
        style: { stroke: '#0ea5e9', strokeWidth: 1.75 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#0ea5e9',
          width: 15,
          height: 15
        }
      });
    });
    
    return { initialNodes: nodes, initialEdges: edges };
  }, [tables, relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Synchronize nodes and edges immediately when initialNodes/initialEdges or selectedNode changes
  React.useEffect(() => {
    setNodes(initialNodes.map(n => ({
      ...n,
      selected: n.id === selectedNode
    })));
  }, [initialNodes, selectedNode, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    onSelectNode(node.id);
  }, [onSelectNode]);

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      className="bg-slate-950 select-none"
    >
      <Background color="#1e293b" gap={24} size={1} />
      <Controls className="!bg-slate-900 !border-slate-700 !shadow-2xl" showInteractive={false} />
      <MiniMap 
        nodeColor={(n) => {
          if (n.selected) return '#06b6d4';
          return '#334155';
        }}
        nodeStrokeColor="#1e293b"
        maskColor="rgba(2, 6, 23, 0.75)"
        className="!bg-slate-950 !border !border-slate-800 rounded-xl overflow-hidden shadow-2xl"
      />
    </ReactFlow>
  );
};
