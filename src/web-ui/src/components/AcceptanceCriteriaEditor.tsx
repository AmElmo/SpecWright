import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

interface AcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
}

interface JobStory {
  job_story_id: string;
  title: string;
  situation: string;
  motivation: string;
  outcome: string;
  acceptance_criteria: AcceptanceCriterion[];
}

interface AcceptanceCriteriaData {
  project_id: string;
  project_name: string;
  job_stories: JobStory[];
}

interface AcceptanceCriteriaEditorProps {
  content: string;
  projectId: string;
  onSave: (content: string) => void;
  readOnly?: boolean;
}

export function AcceptanceCriteriaEditor({ content, projectId, onSave, readOnly = false }: AcceptanceCriteriaEditorProps) {
  const [data, setData] = useState<AcceptanceCriteriaData>(() => {
    try {
      return JSON.parse(content);
    } catch {
      return { project_id: projectId, project_name: '', job_stories: [] };
    }
  });
  
  const [saving, setSaving] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AcceptanceCriterion | null>(null);
  const [addingToStory, setAddingToStory] = useState<string | null>(null);
  const [newCriterion, setNewCriterion] = useState<Omit<AcceptanceCriterion, 'id'>>({ given: '', when: '', then: '' });
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set(data.job_stories.map(js => js.job_story_id)));

  // Sync with external content changes
  useEffect(() => {
    try {
      const parsed = JSON.parse(content);
      setData(parsed);
      setExpandedStories(new Set(parsed.job_stories.map((js: JobStory) => js.job_story_id)));
    } catch {
      // Keep current state if parsing fails
    }
  }, [content]);

  const saveData = async (newData: AcceptanceCriteriaData) => {
    setSaving(true);
    try {
      const jsonString = JSON.stringify(newData, null, 2);
      await fetch(`/api/specification/document/${projectId}/documents/acceptance_criteria.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: jsonString })
      });
      setData(newData);
      onSave(jsonString);
    } catch (err) {
      logger.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleStoryExpanded = (storyId: string) => {
    const newExpanded = new Set(expandedStories);
    if (newExpanded.has(storyId)) {
      newExpanded.delete(storyId);
    } else {
      newExpanded.add(storyId);
    }
    setExpandedStories(newExpanded);
  };

  const startEditing = (criterion: AcceptanceCriterion) => {
    setEditingCriterion(criterion.id);
    setEditForm({ ...criterion });
  };

  const cancelEditing = () => {
    setEditingCriterion(null);
    setEditForm(null);
  };

  const saveEdit = (storyId: string) => {
    if (!editForm) return;
    
    const newData = { ...data };
    const story = newData.job_stories.find(js => js.job_story_id === storyId);
    if (story) {
      const criterionIndex = story.acceptance_criteria.findIndex(ac => ac.id === editForm.id);
      if (criterionIndex !== -1) {
        story.acceptance_criteria[criterionIndex] = editForm;
        saveData(newData);
      }
    }
    cancelEditing();
  };

  const deleteCriterion = (storyId: string, criterionId: string) => {
    if (!confirm('Are you sure you want to delete this acceptance criterion?')) return;
    
    const newData = { ...data };
    const story = newData.job_stories.find(js => js.job_story_id === storyId);
    if (story) {
      story.acceptance_criteria = story.acceptance_criteria.filter(ac => ac.id !== criterionId);
      saveData(newData);
    }
  };

  const startAddingCriterion = (storyId: string) => {
    setAddingToStory(storyId);
    setNewCriterion({ given: '', when: '', then: '' });
  };

  const cancelAdding = () => {
    setAddingToStory(null);
    setNewCriterion({ given: '', when: '', then: '' });
  };

  const addCriterion = (storyId: string) => {
    if (!newCriterion.given.trim() || !newCriterion.when.trim() || !newCriterion.then.trim()) {
      return;
    }
    
    const newData = { ...data };
    const story = newData.job_stories.find(js => js.job_story_id === storyId);
    if (story) {
      // Generate next ID
      const storyPrefix = storyId.replace('js_', 'ac_');
      const existingIds = story.acceptance_criteria.map(ac => {
        const match = ac.id.match(/_(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextNum = Math.max(0, ...existingIds) + 1;
      const newId = `${storyPrefix}_${String(nextNum).padStart(2, '0')}`;
      
      story.acceptance_criteria.push({
        id: newId,
        ...newCriterion
      });
      saveData(newData);
    }
    cancelAdding();
  };

  const hasNoData = !data.job_stories || data.job_stories.length === 0;

  if (hasNoData) {
    return (
      <Card className="bg-white border-slate-200 p-8 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Acceptance Criteria Yet</h3>
        <p className="text-slate-600 text-sm">
          Acceptance criteria will be generated when the Product Manager creates the PRD.
        </p>
      </Card>
    );
  }

  const totalCriteria = data.job_stories.reduce((sum, story) => sum + story.acceptance_criteria.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Acceptance Criteria</h3>
          <p className="text-sm text-slate-600">
            {data.job_stories.length} job {data.job_stories.length === 1 ? 'story' : 'stories'} • {totalCriteria} {totalCriteria === 1 ? 'criterion' : 'criteria'}
          </p>
        </div>
        {saving && (
          <span className="text-sm text-slate-500 flex items-center gap-2">
            <span className="animate-spin">⏳</span> Saving...
          </span>
        )}
      </div>

      {/* Job Stories */}
      {data.job_stories.map((story) => {
        const isExpanded = expandedStories.has(story.job_story_id);
        
        return (
          <Card key={story.job_story_id} className="bg-white border-slate-200 overflow-hidden">
            {/* Story Header */}
            <div
              className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition"
              onClick={() => toggleStoryExpanded(story.job_story_id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-xl">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span className="text-blue-600">📖</span>
                      {story.title}
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      {story.acceptance_criteria.length} acceptance {story.acceptance_criteria.length === 1 ? 'criterion' : 'criteria'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Job Story Details (always visible) */}
              <div className="mt-3 pl-9 text-sm text-slate-700 space-y-1">
                <p><span className="font-medium text-slate-500">When</span> {story.situation}</p>
                <p><span className="font-medium text-slate-500">I want to</span> {story.motivation}</p>
                <p><span className="font-medium text-slate-500">So that</span> {story.outcome}</p>
              </div>
            </div>

            {/* Acceptance Criteria List */}
            {isExpanded && (
              <div className="p-4 space-y-4">
                {story.acceptance_criteria.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <p>No acceptance criteria for this job story yet.</p>
                  </div>
                ) : (
                  story.acceptance_criteria.map((criterion) => {
                    const isEditing = editingCriterion === criterion.id;
                    
                    return (
                      <Card
                        key={criterion.id}
                        className={`p-4 transition border-l-4 ${
                          isEditing
                            ? 'border-l-blue-500 bg-blue-50'
                            : 'border-l-green-500 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        {isEditing && editForm ? (
                          /* Edit Mode */
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono text-slate-500">{criterion.id}</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => saveEdit(story.job_story_id)}
                                  disabled={!editForm.given.trim() || !editForm.when.trim() || !editForm.then.trim()}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-semibold text-green-700 mb-1">GIVEN</label>
                              <Textarea
                                value={editForm.given}
                                onChange={(e) => setEditForm({ ...editForm, given: e.target.value })}
                                className="w-full"
                                rows={2}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-semibold text-blue-700 mb-1">WHEN</label>
                              <Textarea
                                value={editForm.when}
                                onChange={(e) => setEditForm({ ...editForm, when: e.target.value })}
                                className="w-full"
                                rows={2}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-semibold text-purple-700 mb-1">THEN</label>
                              <Textarea
                                value={editForm.then}
                                onChange={(e) => setEditForm({ ...editForm, then: e.target.value })}
                                className="w-full"
                                rows={2}
                              />
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div>
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-xs font-mono text-slate-400 bg-slate-200 px-2 py-0.5 rounded">
                                {criterion.id}
                              </span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditing(criterion)}
                                  className="text-slate-500 hover:text-blue-600"
                                >
                                  ✏️ Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteCriterion(story.job_story_id, criterion.id)}
                                  className="text-slate-500 hover:text-red-600"
                                >
                                  🗑️
                                </Button>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-green-700 w-14 flex-shrink-0">GIVEN</span>
                                <span className="text-slate-700">{criterion.given}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 w-14 flex-shrink-0">WHEN</span>
                                <span className="text-slate-700">{criterion.when}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-purple-700 w-14 flex-shrink-0">THEN</span>
                                <span className="text-slate-700">{criterion.then}</span>
                              </div>
                            </div>
                            
                            {/* Hover actions - only shown when not readOnly */}
                            {!readOnly && (
                              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditing(criterion)}
                                  className="text-slate-500 hover:text-blue-600 text-xs"
                                >
                                  ✏️ Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteCriterion(story.job_story_id, criterion.id)}
                                  className="text-slate-500 hover:text-red-600 text-xs"
                                >
                                  🗑️ Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}

                {/* Add New Criterion - only shown when not readOnly */}
                {!readOnly && (
                  addingToStory === story.job_story_id ? (
                    <Card className="p-4 border-2 border-dashed border-blue-300 bg-blue-50">
                      <h5 className="text-sm font-semibold text-blue-900 mb-3">Add New Acceptance Criterion</h5>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-semibold text-green-700 mb-1">GIVEN</label>
                          <Textarea
                            value={newCriterion.given}
                            onChange={(e) => setNewCriterion({ ...newCriterion, given: e.target.value })}
                            placeholder="the initial context or precondition..."
                            className="w-full"
                            rows={2}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-blue-700 mb-1">WHEN</label>
                          <Textarea
                            value={newCriterion.when}
                            onChange={(e) => setNewCriterion({ ...newCriterion, when: e.target.value })}
                            placeholder="the action or event that triggers..."
                            className="w-full"
                            rows={2}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-purple-700 mb-1">THEN</label>
                          <Textarea
                            value={newCriterion.then}
                            onChange={(e) => setNewCriterion({ ...newCriterion, then: e.target.value })}
                            placeholder="the expected outcome or result..."
                            className="w-full"
                            rows={2}
                          />
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelAdding}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => addCriterion(story.job_story_id)}
                            disabled={!newCriterion.given.trim() || !newCriterion.when.trim() || !newCriterion.then.trim()}
                          >
                            Add Criterion
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => startAddingCriterion(story.job_story_id)}
                      className="w-full border-dashed text-slate-500 hover:text-blue-600 hover:border-blue-400"
                    >
                      ➕ Add acceptance criterion to this job story
                    </Button>
                  )
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

