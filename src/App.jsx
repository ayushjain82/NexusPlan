import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Trash2, Calendar, Link as LinkIcon, AlertTriangle, 
  Activity, X, GripVertical, Edit2, AlertCircle, Check,
  Rocket, Flag, FileText, Octagon, ChevronRight, ChevronDown
} from 'lucide-react';
import { 
  format, addWeeks, parseISO, startOfQuarter, 
  addQuarters, differenceInCalendarWeeks, addDays, differenceInDays, isValid, startOfMonth, addMonths 
} from 'date-fns';

// --- Constants ---
const MAX_COMPONENTS = 10;
const SIDEBAR_WIDTH = 192; // w-48 = 192px
const TASK_HEIGHT = 40;    
const TASK_GAP = 10;       
const ROW_PADDING = 24;    
const HEADER_HEIGHT = 40;  // Height of the main track header (W1/Q1)
const DATE_HEADER_HEIGHT = 24; // New row for specific dates
const MILESTONE_HEIGHT = 48; // Height of the milestone row

// Total sticky height calculation
const TOTAL_HEADER_HEIGHT = HEADER_HEIGHT + DATE_HEADER_HEIGHT + MILESTONE_HEIGHT;

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  // --- State ---
  const [programStart, setProgramStart] = useState('2025-01-01');
  const [viewMode, setViewMode] = useState('weeks'); // 'weeks' | 'quarters'
  
  const [components, setComponents] = useState([
    { id: 'c1', name: 'Backend Infrastructure', color: 'bg-blue-100 border-blue-300' },
    { id: 'c2', name: 'Mobile App Dev', color: 'bg-purple-100 border-purple-300' },
    { id: 'c3', name: 'Web Portal', color: 'bg-emerald-100 border-emerald-300' },
    { id: 'c4', name: 'QA & Compliance', color: 'bg-amber-100 border-amber-300' }
  ]);

  const [tasks, setTasks] = useState([
    { id: 't1', componentId: 'c1', name: 'System Architecture', startWeek: 0, duration: 8 },
    { id: 't2', componentId: 'c1', name: 'Database Setup', startWeek: 2, duration: 4 }, 
    { id: 't3', componentId: 'c2', name: 'UI Design', startWeek: 5, duration: 4 },
    { id: 't4', componentId: 'c2', name: 'App Integration', startWeek: 10, duration: 4 },
    { id: 't5', componentId: 'c3', name: 'API Development', startWeek: 5, duration: 5 },
    { id: 't6', componentId: 'c4', name: 'Compliance Review Meeting', startWeek: 2, duration: 1 }, 
  ]);

  const [milestones, setMilestones] = useState([
    { id: 'm1', name: 'Program Kickoff', type: 'Go-Live', date: '2025-01-05' },
    { id: 'm2', name: 'Weekly Status', type: 'Status Report', startDate: '2025-01-10', endDate: '2025-03-01', frequency: 'weekly' }
  ]);

  const [dependencies, setDependencies] = useState([
    { id: 'd1', from: 't1', to: 't3', type: 'blocker' }, 
    { id: 'd2', from: 't1', to: 't5', type: 'blocker' }, 
    { id: 'd3', from: 't2', to: 't5', type: 'normal' },  
    { id: 'd4', from: 't3', to: 't4', type: 'blocker' }, 
  ]);

  const [selectedTask, setSelectedTask] = useState(null); 
  const [selectedMilestone, setSelectedMilestone] = useState(null); 
  const [taskToDelete, setTaskToDelete] = useState(null); 
  const [viewWeeks, setViewWeeks] = useState(24);
  const [dragState, setDragState] = useState(null); 
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);

  // --- Add/Draft States ---
  const [isAddingComponent, setIsAddingComponent] = useState(false);
  const [newCompName, setNewCompName] = useState('');

  const [addingActivityTo, setAddingActivityTo] = useState(null); // componentId
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityStart, setNewActivityStart] = useState(0);
  const [newActivityDuration, setNewActivityDuration] = useState(4);

  // --- Dependency Form State ---
  const [newDepCompId, setNewDepCompId] = useState('');
  const [newDepTaskId, setNewDepTaskId] = useState('');
  const [newDepIsBlocker, setNewDepIsBlocker] = useState(false);

  // --- Dynamic Constants based on View Mode ---
  const pixelsPerWeek = viewMode === 'weeks' ? 60 : 15;

  useEffect(() => {
    if (viewMode === 'quarters') {
      setViewWeeks(Math.max(viewWeeks, 52));
    }
  }, [viewMode]);

  useEffect(() => {
    setNewDepCompId('');
    setNewDepTaskId('');
    setNewDepIsBlocker(false);
  }, [selectedTask]);

  // --- LAYOUT ENGINE ---
  const layout = useMemo(() => {
    const compLayouts = {}; 
    const taskLayouts = {}; 
    let currentY = 0; 

    components.forEach(comp => {
      const compTasks = tasks.filter(t => t.componentId === comp.id);
      const sortedTasks = [...compTasks].sort((a, b) => a.startWeek - b.startWeek);
      const lanes = []; 
      
      sortedTasks.forEach(task => {
        let laneIndex = -1;
        for (let i = 0; i < lanes.length; i++) {
          if (lanes[i] <= task.startWeek) {
            laneIndex = i;
            break;
          }
        }
        if (laneIndex === -1) {
          laneIndex = lanes.length;
          lanes.push(0);
        }
        lanes[laneIndex] = task.startWeek + task.duration;
        const localTop = ROW_PADDING + (laneIndex * (TASK_HEIGHT + TASK_GAP));
        
        taskLayouts[task.id] = {
          lane: laneIndex,
          localTop: localTop,
          absoluteTop: currentY + localTop,
          absoluteCenterY: currentY + localTop + (TASK_HEIGHT / 2)
        };
      });

      const numLanes = Math.max(1, lanes.length); 
      const rowHeight = (ROW_PADDING * 2) + (numLanes * TASK_HEIGHT) + ((numLanes - 1) * TASK_GAP);
      compLayouts[comp.id] = { top: currentY, height: rowHeight };
      currentY += rowHeight; 
    });

    return { compLayouts, taskLayouts, totalHeight: currentY };
  }, [components, tasks]);

  // --- Scheduler Logic ---
  useEffect(() => {
    let hasChanges = false;
    const newTasks = [...tasks];

    for (let pass = 0; pass < 5; pass++) {
      dependencies.forEach(dep => {
        const fromTask = newTasks.find(t => t.id === dep.from);
        const toTask = newTasks.find(t => t.id === dep.to);

        if (fromTask && toTask) {
          const minStart = fromTask.startWeek + fromTask.duration;
          if (toTask.startWeek < minStart) {
            toTask.startWeek = minStart;
            hasChanges = true;
          }
        }
      });
    }

    if (hasChanges) {
        const isDifferent = JSON.stringify(newTasks) !== JSON.stringify(tasks);
        if (isDifferent) setTasks(newTasks);
    }
  }, [dependencies, tasks, dragState]); 

  // --- Drag Handling ---
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;
      const deltaX = e.clientX - dragState.startX;
      const deltaWeeks = Math.round(deltaX / pixelsPerWeek);
      
      if (deltaWeeks === 0 && dragState.lastDelta === 0) return;

      const task = tasks.find(t => t.id === dragState.taskId);
      if (!task) return;

      let newStart = dragState.originalStart;
      let newDuration = dragState.originalDuration;

      if (dragState.type === 'move') {
        newStart = Math.max(0, dragState.originalStart + deltaWeeks);
      } else if (dragState.type === 'resize') {
        newDuration = Math.max(1, dragState.originalDuration + deltaWeeks);
      }

      if (task.startWeek !== newStart || task.duration !== newDuration) {
         setTasks(prev => prev.map(t => t.id === dragState.taskId ? { ...t, startWeek: newStart, duration: newDuration } : t));
      }
    };

    const handleMouseUp = () => setDragState(null);

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, tasks, pixelsPerWeek]);

  // --- Handlers ---
  const handleMouseDown = (e, task, type) => {
    e.stopPropagation();
    setDragState({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalStart: task.startWeek,
      originalDuration: task.duration,
      lastDelta: 0
    });
  };

  // -- Component Add Logic --
  const handleStartAddComponent = () => {
    if (components.length >= MAX_COMPONENTS) return;
    setNewCompName('');
    setIsAddingComponent(true);
  };

  const handleCancelAddComponent = () => {
    setIsAddingComponent(false);
  };

  const handleConfirmAddComponent = () => {
    if (!newCompName.trim()) return;
    setComponents([...components, { 
      id: generateId(), 
      name: newCompName, 
      color: 'bg-slate-100 border-slate-300' 
    }]);
    setIsAddingComponent(false);
  };

  // -- Activity Add Logic --
  const handleStartAddActivity = (compId) => {
    setNewActivityName('');
    setNewActivityStart(0);
    setNewActivityDuration(4);
    setAddingActivityTo(compId);
    setSelectedTask(null); // Close other edit modes
  };

  const handleCancelAddActivity = () => {
    setAddingActivityTo(null);
  };

  const handleConfirmAddActivity = () => {
    if (!newActivityName.trim()) return;
    setTasks([...tasks, { 
      id: generateId(), 
      componentId: addingActivityTo, 
      name: newActivityName, 
      startWeek: newActivityStart, 
      duration: newActivityDuration 
    }]);
    setAddingActivityTo(null);
  };

  const updateTask = (id, field, value) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleAddDependency = () => {
    if (!newDepTaskId || !selectedTask) return;
    const exists = dependencies.some(d => d.from === newDepTaskId && d.to === selectedTask.id);
    if (exists) return;
    if (newDepTaskId === selectedTask.id) return;

    setDependencies([...dependencies, { id: generateId(), from: newDepTaskId, to: selectedTask.id, type: newDepIsBlocker ? 'blocker' : 'normal' }]);
    setNewDepTaskId('');
  };

  const removeDependency = (id) => setDependencies(dependencies.filter(d => d.id !== id));

  const confirmDelete = () => {
    if (taskToDelete) {
        setTasks(tasks.filter(t => t.id !== taskToDelete));
        if (selectedTask?.id === taskToDelete) setSelectedTask(null);
        setTaskToDelete(null);
    }
  };

  // --- Milestone Handlers ---
  const handleAddMilestone = () => {
    setMilestones([...milestones, { 
      id: generateId(), 
      name: 'New Milestone', 
      type: 'Go-Live', 
      date: format(parseISO(programStart), 'yyyy-MM-dd') 
    }]);
    setShowMilestoneForm(true);
    setSelectedMilestone(milestones.length); 
  };

  const updateMilestone = (id, field, value) => {
    setMilestones(milestones.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const deleteMilestone = (id) => {
    setMilestones(milestones.filter(m => m.id !== id));
    if (selectedMilestone?.id === id) setSelectedMilestone(null);
  };

  // --- Render Helpers ---
  const risks = useMemo(() => {
    const list = [];
    tasks.forEach(t => {
      if (t.startWeek + t.duration > viewWeeks) {
        list.push({ level: 'High', msg: `"${t.name}" overruns program timeline.` });
      }
    });
    return list;
  }, [tasks, viewWeeks]);

  // Calculated Headers
  const timeData = useMemo(() => {
    const start = parseISO(programStart);
    const end = addWeeks(start, viewWeeks);
    
    // Week Headers (Row 1)
    const weeks = Array.from({ length: viewWeeks }).map((_, i) => ({
      label: `W${i + 1}`,
      left: i * pixelsPerWeek,
      width: pixelsPerWeek,
      date: format(addWeeks(start, i), 'MM/dd') // For new Date Row
    }));

    // Quarter Headers (Row 1 alternative)
    const quarters = [];
    let currentQ = startOfQuarter(start);
    while (currentQ < end) {
      const nextQ = addQuarters(currentQ, 1);
      const startWeekDiff = differenceInCalendarWeeks(currentQ, start);
      const durationWeeks = differenceInCalendarWeeks(nextQ, currentQ);
      if (startWeekDiff + durationWeeks > 0) {
        quarters.push({
          label: format(currentQ, "'Q'Q yyyy"),
          left: startWeekDiff * pixelsPerWeek,
          width: durationWeeks * pixelsPerWeek
        });
      }
      currentQ = nextQ;
    }

    // Month Headers (Row 2 for Quarter View)
    const months = [];
    let currentM = startOfMonth(start);
    while (currentM < end) {
      const nextM = addMonths(currentM, 1);
      const startWeekDiff = differenceInCalendarWeeks(currentM, start);
      if (startWeekDiff + 4 > 0 && startWeekDiff < viewWeeks) {
         months.push({
             label: format(currentM, 'MM/dd'),
             left: startWeekDiff * pixelsPerWeek
         });
      }
      currentM = nextM;
    }

    return { weeks, quarters, months };
  }, [programStart, viewWeeks, pixelsPerWeek, viewMode]);

  const getMilestoneIcon = (type) => {
    switch (type) {
      case 'Go-Live': return <Rocket size={16} className="text-emerald-600" />;
      case 'Go/No Go': return <Octagon size={16} className="text-red-600" />;
      case 'Roll out': return <Flag size={16} className="text-blue-600" />;
      case 'Status Report': return <FileText size={16} className="text-slate-500" />;
      default: return <Activity size={16} className="text-slate-500" />;
    }
  };

  const expandedMilestones = useMemo(() => {
    const points = [];
    const start = parseISO(programStart);

    milestones.forEach(m => {
      // Hide Status Reports in Quarter Mode
      if (viewMode === 'quarters' && m.type === 'Status Report') return;

      if (m.type === 'Status Report' && m.startDate && m.endDate) {
        let current = parseISO(m.startDate);
        const end = parseISO(m.endDate);
        const daysToAdd = m.frequency === 'biweekly' ? 14 : 7;

        while (current <= end) {
          if (isValid(current)) {
            const diffWeeks = differenceInDays(current, start) / 7;
            if (diffWeeks >= 0 && diffWeeks <= viewWeeks) {
              points.push({ ...m, renderWeek: diffWeeks, isRecurring: true });
            }
          }
          current = addDays(current, daysToAdd);
        }
      } else if (m.date) {
        const date = parseISO(m.date);
        if (isValid(date)) {
          const diffWeeks = differenceInDays(date, start) / 7;
          if (diffWeeks >= 0 && diffWeeks <= viewWeeks) {
            points.push({ ...m, renderWeek: diffWeeks, isRecurring: false });
          }
        }
      }
    });
    return points;
  }, [milestones, programStart, viewWeeks, viewMode]);

  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans overflow-hidden selection:bg-indigo-100">
      
      {/* 1. Top Bar */}
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-slate-50 flex-shrink-0 z-50 relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-md shadow-indigo-200">
            <LinkIcon size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-slate-900">Nexus Plan</h1>
            <div className="text-xs text-slate-500 font-medium">Interactive Roadmap</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-200 rounded-lg p-1 border border-slate-300">
            <button onClick={() => setViewMode('weeks')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'weeks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Weeks</button>
            <button onClick={() => setViewMode('quarters')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'quarters' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Quarters</button>
          </div>
          <div className="h-6 w-px bg-slate-300 mx-2"></div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-slate-300 shadow-sm">
            <Calendar size={14} className="text-slate-400" />
            <input type="date" value={programStart} onChange={(e) => setProgramStart(e.target.value)} className="text-sm outline-none font-medium text-slate-700 bg-transparent"/>
          </div>
          
          {/* Removed Add Component Button from here */}
          
          <div className="h-6 w-px bg-slate-300 mx-2"></div>
          {risks.length > 0 ? (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 px-3 py-1.5 rounded-md border border-red-200 animate-pulse">
              <AlertTriangle size={16} /><span className="text-sm font-bold">{risks.length} Risks</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
              <Activity size={16} /><span className="text-sm font-bold">On Track</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar: Editor */}
        <div className="w-96 border-r border-slate-200 bg-white flex flex-col z-40 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            
            {/* Milestones Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Milestones</h3>
                <button onClick={handleAddMilestone} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded transition-colors"><Plus size={16} /></button>
              </div>
              <div className="space-y-2">
                {milestones.map(m => {
                  const isEditing = selectedMilestone?.id === m.id;
                  return (
                    <div key={m.id} className={`rounded-xl border bg-white overflow-hidden transition-all ${isEditing ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md' : 'border-slate-200 hover:border-indigo-200'}`}>
                      <div 
                        className="p-3 flex items-center justify-between cursor-pointer bg-slate-50"
                        onClick={() => setSelectedMilestone(isEditing ? null : m)}
                      >
                        <div className="flex items-center gap-2">
                          {getMilestoneIcon(m.type)}
                          <span className="text-sm font-bold text-slate-700">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedMilestone(isEditing ? null : m)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={12}/></button>
                          <button onClick={(e) => { e.stopPropagation(); deleteMilestone(m.id); }} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                        </div>
                      </div>
                      
                      {isEditing && (
                        <div className="p-3 space-y-3 bg-white border-t border-slate-100 animate-in slide-in-from-top-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Name</label>
                            <input className="w-full text-xs px-2 py-1.5 border rounded bg-slate-50" value={m.name} onChange={(e) => updateMilestone(m.id, 'name', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Type</label>
                            <select className="w-full text-xs px-2 py-1.5 border rounded bg-slate-50" value={m.type} onChange={(e) => updateMilestone(m.id, 'type', e.target.value)}>
                              <option>Go-Live</option>
                              <option>Go/No Go</option>
                              <option>Roll out</option>
                              <option>Status Report</option>
                            </select>
                          </div>
                          
                          {m.type === 'Status Report' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Start Date</label>
                                <input type="date" className="w-full text-xs px-2 py-1.5 border rounded bg-slate-50" value={m.startDate || ''} onChange={(e) => updateMilestone(m.id, 'startDate', e.target.value)} />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">End Date</label>
                                <input type="date" className="w-full text-xs px-2 py-1.5 border rounded bg-slate-50" value={m.endDate || ''} onChange={(e) => updateMilestone(m.id, 'endDate', e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Frequency</label>
                                <select className="w-full text-xs px-2 py-1.5 border rounded bg-slate-50" value={m.frequency || 'weekly'} onChange={(e) => updateMilestone(m.id, 'frequency', e.target.value)}>
                                  <option value="weekly">Weekly</option>
                                  <option value="biweekly">Bi-weekly</option>
                                </select>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                              <input type="date" className="w-full text-xs px-2 py-1.5 border rounded bg-slate-50" value={m.date || ''} onChange={(e) => updateMilestone(m.id, 'date', e.target.value)} />
                            </div>
                          )}
                          <button onClick={() => setSelectedMilestone(null)} className="w-full bg-slate-800 text-white py-1.5 rounded text-xs font-bold">Done</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-200 my-4"></div>

            {/* Component List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Components</h3>
                <button onClick={handleStartAddComponent} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded transition-colors" title="Add Component"><Plus size={16} /></button>
              </div>

              {/* NEW: Draft Component Form */}
              {isAddingComponent && (
                <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl p-3 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-bold text-indigo-500 uppercase mb-1 block">New Component Name</label>
                    <input 
                        autoFocus
                        className="w-full text-sm px-2 py-1.5 border border-indigo-200 rounded bg-white outline-none focus:ring-2 focus:ring-indigo-400 mb-2"
                        value={newCompName}
                        onChange={(e) => setNewCompName(e.target.value)}
                        placeholder="e.g. Frontend Team"
                    />
                    <div className="flex gap-2">
                        <button onClick={handleCancelAddComponent} className="flex-1 py-1.5 rounded bg-white text-slate-600 border border-slate-200 text-xs font-bold hover:bg-slate-50">Cancel</button>
                        <button onClick={handleConfirmAddComponent} className="flex-1 py-1.5 rounded bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">Add</button>
                    </div>
                </div>
              )}

              <div className="space-y-6">
                {components.map(comp => (
                  <div key={comp.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Component Header */}
                    <div className={`px-3 py-2 flex items-center justify-between ${comp.color}`}>
                      <input 
                        value={comp.name}
                        onChange={(e) => {
                          const newComps = [...components];
                          newComps.find(c => c.id === comp.id).name = e.target.value;
                          setComponents(newComps);
                        }}
                        className="bg-transparent font-bold text-sm text-slate-800 outline-none w-full placeholder-slate-400"
                        placeholder="Component Name"
                      />
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleStartAddActivity(comp.id)} className="text-slate-500 hover:text-indigo-600 hover:bg-white/50 p-1 rounded transition-colors"><Plus size={16} /></button>
                        <button onClick={() => setComponents(components.filter(c => c.id !== comp.id))} className="text-slate-400 hover:text-red-500 hover:bg-white/50 p-1 rounded transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    
                    <div className="p-2 space-y-2 bg-white">
                        
                      {/* NEW: Draft Activity Form */}
                      {addingActivityTo === comp.id && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-2 animate-in slide-in-from-top-2">
                            <h4 className="text-[10px] font-bold text-indigo-500 uppercase mb-2">New Activity</h4>
                            <div className="space-y-2">
                                <input 
                                    autoFocus
                                    className="w-full text-xs px-2 py-1.5 border border-indigo-200 rounded bg-white outline-none"
                                    placeholder="Activity Name"
                                    value={newActivityName}
                                    onChange={(e) => setNewActivityName(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-[9px] text-slate-500 uppercase block mb-0.5">Start Wk</label>
                                        <input type="number" className="w-full text-xs px-2 py-1 border border-indigo-200 rounded" value={newActivityStart} onChange={(e) => setNewActivityStart(parseInt(e.target.value))} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[9px] text-slate-500 uppercase block mb-0.5">Duration</label>
                                        <input type="number" className="w-full text-xs px-2 py-1 border border-indigo-200 rounded" value={newActivityDuration} onChange={(e) => setNewActivityDuration(parseInt(e.target.value))} />
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button onClick={handleCancelAddActivity} className="flex-1 py-1 rounded bg-white text-slate-600 border border-slate-200 text-xs hover:bg-slate-50"><X size={14} className="mx-auto"/></button>
                                    <button onClick={handleConfirmAddActivity} className="flex-1 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700"><Check size={14} className="mx-auto"/></button>
                                </div>
                            </div>
                        </div>
                      )}

                      {tasks.filter(t => t.componentId === comp.id).map(task => {
                        const isEditing = selectedTask?.id === task.id;
                        return (
                            <div key={task.id} className={`rounded-lg border transition-all ${isEditing ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-indigo-200'}`}>
                                {/* Activity Row Summary */}
                                <div className="p-2 flex justify-between items-center group">
                                    <div className="font-medium text-slate-700 text-sm truncate pr-2 flex-1 cursor-pointer" onClick={() => setSelectedTask(isEditing ? null : task)}>
                                        {task.name}
                                        <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{task.duration}w</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setSelectedTask(isEditing ? null : task)} className={`p-1.5 rounded-md hover:bg-indigo-100 ${isEditing ? 'text-indigo-600 bg-indigo-100' : 'text-slate-400'}`}><Edit2 size={12} /></button>
                                        <button onClick={() => setTaskToDelete(task.id)} className="p-1.5 rounded-md hover:bg-red-100 text-slate-400 hover:text-red-600"><Trash2 size={12} /></button>
                                    </div>
                                </div>

                                {/* Inline Edit Form */}
                                {isEditing && (
                                    <div className="px-3 pb-3 pt-1 border-t border-indigo-100 space-y-3 animate-in slide-in-from-top-2 fade-in">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Name</label>
                                            <input className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white focus:border-indigo-500 outline-none" value={task.name} onChange={(e) => updateTask(task.id, 'name', e.target.value)} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Start Wk</label>
                                                <input type="number" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white" value={task.startWeek} onChange={(e) => updateTask(task.id, 'startWeek', parseInt(e.target.value))}/>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">End Wk</label>
                                                <input type="number" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white" value={task.startWeek + task.duration} onChange={(e) => updateTask(task.id, 'duration', Math.max(1, parseInt(e.target.value) - task.startWeek))}/>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white p-2 rounded border border-slate-200">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Dependencies</label>
                                            <div className="space-y-1 mb-2">
                                                {dependencies.filter(d => d.to === task.id).map(dep => {
                                                    const source = tasks.find(t => t.id === dep.from);
                                                    return (
                                                        <div key={dep.id} className="flex justify-between items-center text-[10px] bg-slate-50 px-2 py-1 rounded">
                                                            <span className="truncate max-w-[100px]">{source?.name}</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className={`px-1 rounded font-bold ${dep.type === 'blocker' ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-100'}`}>{dep.type}</span>
                                                                <button onClick={() => removeDependency(dep.id)} className="text-slate-400 hover:text-red-500"><X size={10}/></button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {dependencies.filter(d => d.to === task.id).length === 0 && <div className="text-[10px] text-slate-300 italic">None</div>}
                                            </div>
                                            
                                            <div className="flex gap-1">
                                                <select className="flex-1 text-[10px] border border-slate-200 rounded bg-slate-50" value={newDepCompId} onChange={(e) => setNewDepCompId(e.target.value)}>
                                                    <option value="">Component...</option>
                                                    {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                                <select className="flex-1 text-[10px] border border-slate-200 rounded bg-slate-50" value={newDepTaskId} onChange={(e) => setNewDepTaskId(e.target.value)} disabled={!newDepCompId}>
                                                    <option value="">Activity...</option>
                                                    {tasks.filter(t => t.componentId === newDepCompId && t.id !== task.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer">
                                                    <input type="checkbox" checked={newDepIsBlocker} onChange={(e) => setNewDepIsBlocker(e.target.checked)} className="rounded border-slate-300 text-indigo-600"/> Blocker?
                                                </label>
                                                <button onClick={handleAddDependency} disabled={!newDepTaskId} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:opacity-50">Add Link</button>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedTask(null)} className="w-full flex items-center justify-center gap-1 bg-slate-800 text-white py-1.5 rounded text-xs font-bold hover:bg-slate-900 transition-colors"><Check size={12} /> Done</button>
                                    </div>
                                )}
                            </div>
                        );
                      })}
                      {tasks.filter(t => t.componentId === comp.id).length === 0 && !addingActivityTo && (
                        <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg italic">No activities yet</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Gantt Visualization */}
        <div className="flex-1 overflow-auto bg-slate-50 relative custom-scrollbar">
          
          <div style={{ width: `${viewWeeks * pixelsPerWeek + 400}px` }} className="min-h-full pb-20 select-none relative">
            
            {/* Header Group (Sticky) */}
            <div className={`sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm`} style={{ height: TOTAL_HEADER_HEIGHT }}>
              {/* Row 1: Time Headers */}
              <div className="flex border-b border-slate-100" style={{ height: HEADER_HEIGHT }}>
                <div className="w-48 flex-shrink-0 border-r border-slate-100 p-2 text-xs font-bold text-slate-400 bg-slate-50 uppercase tracking-wider flex items-center">Track</div>
                {viewMode === 'weeks' ? (
                  Array.from({ length: viewWeeks }).map((_, i) => (
                    <div key={i} style={{ width: pixelsPerWeek }} className="flex-shrink-0 border-r border-slate-100 flex items-center justify-center text-xs text-slate-400 font-medium">W{i + 1}</div>
                  ))
                ) : (
                  <div className="relative flex-1 h-full">
                    {timeData.quarters.map((q, i) => (
                      <div key={i} style={{ left: q.left, width: q.width }} className="absolute top-0 bottom-0 border-r border-slate-300 bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-600">{q.label}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 2: Date Header */}
              <div className="flex border-b border-slate-100 bg-slate-50/50" style={{ height: DATE_HEADER_HEIGHT }}>
                <div className="w-48 flex-shrink-0 border-r border-slate-100 bg-slate-50"></div>
                {viewMode === 'weeks' ? (
                  Array.from({ length: viewWeeks }).map((_, i) => (
                    <div key={i} style={{ width: pixelsPerWeek }} className="flex-shrink-0 border-r border-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                      {timeData.weeks[i].date}
                    </div>
                  ))
                ) : (
                  <div className="relative flex-1 h-full">
                    {timeData.months.map((m, i) => (
                      <div key={i} style={{ left: m.left }} className="absolute top-0 bottom-0 pl-1 flex items-center text-[10px] font-bold text-indigo-400 border-l border-indigo-100 h-full">
                        {m.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 3: Milestones Row */}
              <div className="flex bg-slate-50/80 relative" style={{ height: MILESTONE_HEIGHT }}>
                <div className="w-48 flex-shrink-0 border-r border-slate-100 p-2 text-xs font-bold text-indigo-600 flex items-center bg-indigo-50/30">Milestones</div>
                <div className="flex-1 relative">
                  {expandedMilestones.map((m, i) => (
                    <div 
                      key={i}
                      className="absolute top-1 flex flex-col items-center group cursor-pointer"
                      style={{ left: `${m.renderWeek * pixelsPerWeek}px`, transform: 'translateX(-50%)' }}
                      onClick={() => {
                        if (!m.isRecurring) setSelectedMilestone(milestones.find(orig => orig.id === m.id));
                      }}
                    >
                      <div className="p-1 rounded-full bg-white shadow-sm border border-slate-200 z-10 hover:scale-110 transition-transform">
                        {getMilestoneIcon(m.type)}
                      </div>
                      <div className="h-full border-l border-dashed border-slate-300 absolute top-6 bottom-0 -z-0 h-screen opacity-20 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                      <div className="text-[9px] font-bold text-slate-600 mt-1 bg-white/80 px-1 rounded truncate max-w-[80px] text-center">{m.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Container for Rows and Overlay */}
            <div className="relative">
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
                <defs>
                  <marker id="arrowhead-red" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#ef4444" /></marker>
                  <marker id="arrowhead-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#3b82f6" /></marker>
                </defs>
                {dependencies.map(dep => {
                  const fromTask = tasks.find(t => t.id === dep.from);
                  const toTask = tasks.find(t => t.id === dep.to);
                  if (!fromTask || !toTask) return null;

                  const fromLayout = layout.taskLayouts[fromTask.id];
                  const toLayout = layout.taskLayouts[toTask.id];
                  if (!fromLayout || !toLayout) return null;

                  const startX = (fromTask.startWeek + fromTask.duration) * pixelsPerWeek + SIDEBAR_WIDTH; 
                  const startY = fromLayout.absoluteCenterY;
                  const endX = toTask.startWeek * pixelsPerWeek + SIDEBAR_WIDTH;
                  const endY = toLayout.absoluteCenterY;

                  const isBlocker = dep.type === 'blocker';
                  const color = isBlocker ? '#ef4444' : '#3b82f6';
                  const controlPoint = 40;
                  const path = `M ${startX} ${startY} C ${startX + controlPoint} ${startY}, ${endX - controlPoint} ${endY}, ${endX} ${endY}`;

                  return (
                    <path 
                      key={dep.id} d={path} fill="none" stroke={color} strokeWidth={isBlocker ? 2 : 1.5}
                      markerEnd={`url(#arrowhead-${isBlocker ? 'red' : 'blue'})`} strokeDasharray={isBlocker ? "0" : "4,4"} className="transition-all duration-300"
                    />
                  );
                })}
              </svg>

              {components.map((comp) => {
                const compLayout = layout.compLayouts[comp.id];
                if (!compLayout) return null;

                return (
                  <div key={comp.id} style={{ height: compLayout.height }} className="flex border-b border-slate-200 bg-white bg-opacity-60 hover:bg-opacity-100 transition-colors relative z-10" >
                    <div className="w-48 flex-shrink-0 border-r border-slate-100 p-4 bg-white sticky left-0 z-40 flex flex-col justify-center shadow-[4px_0_12px_rgba(0,0,0,0.01)]">
                      <div className="font-bold text-sm text-slate-700">{comp.name}</div>
                      <div className="text-xs text-slate-400 mt-1 font-medium">{tasks.filter(t => t.componentId === comp.id).length} activities</div>
                    </div>

                    <div className="flex-1 relative">
                      {viewMode === 'weeks' && Array.from({ length: viewWeeks }).map((_, i) => (<div key={i} style={{ left: i * pixelsPerWeek, width: pixelsPerWeek }} className="absolute top-0 bottom-0 border-r border-slate-100 h-full pointer-events-none dashed"></div>))}
                      {viewMode === 'quarters' && timeData.quarters.map((q, i) => (<div key={i} style={{ left: q.left, width: q.width }} className="absolute top-0 bottom-0 border-r border-slate-200 h-full pointer-events-none"></div>))}

                      {tasks.filter(t => t.componentId === comp.id).map(task => {
                        const isSelected = selectedTask?.id === task.id;
                        const taskLayout = layout.taskLayouts[task.id];
                        if (!taskLayout) return null;
                        
                        // Use logic for both Week (<=1 week) and Quarter (<=4 weeks) views
                        const isShortTask = (viewMode === 'weeks' && task.duration <= 1) || (viewMode === 'quarters' && task.duration <= 4);

                        return (
                          <div
                            key={task.id}
                            onMouseDown={(e) => handleMouseDown(e, task, 'move')}
                            style={{
                              left: `${task.startWeek * pixelsPerWeek}px`,
                              width: `${task.duration * pixelsPerWeek}px`,
                              top: taskLayout.localTop,
                              height: TASK_HEIGHT
                            }}
                            className={`
                              absolute rounded-lg border cursor-move group overflow-visible transition-all
                              ${isSelected ? 'ring-2 ring-indigo-600 z-30 shadow-lg' : 'z-30 shadow-sm hover:shadow-md hover:ring-2 hover:ring-indigo-300'}
                              bg-white border-slate-200
                              ${isShortTask ? 'hover:!w-auto hover:min-w-[max-content] hover:z-50 hover:pr-8' : ''}
                            `}
                          >
                            <div className={`absolute inset-0 opacity-10 rounded-lg ${comp.color.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                            <div className={`absolute inset-y-0 left-0 w-1 ${comp.color.split(' ')[0].replace('bg-', 'bg-')} rounded-l-lg opacity-60`}></div>
                            <div className="relative px-2 py-1 h-full flex flex-col justify-center overflow-hidden">
                              <div className="font-bold text-xs text-slate-800 truncate z-20 relative whitespace-nowrap">{task.name}</div>
                              <div className="text-[10px] text-slate-600 font-medium z-20 relative whitespace-nowrap">{task.duration}w</div>
                            </div>
                            <div onMouseDown={(e) => handleMouseDown(e, task, 'resize')} className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-slate-100 rounded-r-lg transition-all"><GripVertical size={12} className="text-slate-400" /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Risk Warnings */}
            {risks.length > 0 && (
              <div className="fixed bottom-6 right-6 z-50 bg-white p-4 rounded-xl shadow-2xl border border-red-100 w-80 animate-in slide-in-from-bottom-10 fade-in duration-300">
                <div className="flex items-center gap-2 mb-3 text-red-600 border-b border-red-50 pb-2"><AlertTriangle size={20} /><h3 className="font-bold">Schedule Risks Detected</h3></div>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">{risks.map((r, i) => (<div key={i} className="text-xs bg-red-50 p-2 rounded text-red-800 border border-red-100 flex items-start gap-2"><span className="mt-0.5">•</span>{r.msg}</div>))}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend Footer */}
      <div className="bg-white border-t border-slate-200 px-6 py-2 text-xs flex items-center gap-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        <span className="font-bold text-slate-400 uppercase tracking-widest mr-2">Legend:</span>
        <div className="flex items-center gap-2">
          <Rocket size={14} className="text-emerald-600" /> <span className="text-slate-600">Go-Live</span>
        </div>
        <div className="flex items-center gap-2">
          <Octagon size={14} className="text-red-600" /> <span className="text-slate-600">Go/No Go</span>
        </div>
        <div className="flex items-center gap-2">
          <Flag size={14} className="text-blue-600" /> <span className="text-slate-600">Roll out</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-slate-500" /> <span className="text-slate-600">Status Report</span>
        </div>
        <div className="h-4 w-px bg-slate-300 mx-2"></div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div> <span className="text-slate-600">Blocker Dependency</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div> <span className="text-slate-600">Normal Dependency</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-96 border border-slate-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600"><AlertCircle size={24} /></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Activity?</h3>
                    <p className="text-sm text-slate-500 mb-6">Are you sure you want to delete this activity? This action cannot be undone.</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => setTaskToDelete(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">Cancel</button>
                        <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors">Delete</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}