import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  ArrowLeft,
  Folder,
  FolderGit,
  FolderPlus,
  Loader2,
  Search,
} from 'lucide-react';
import { fileSystemApi, repoApi } from '@/lib/api';
import { DirectoryEntry, Repo } from 'shared/types';
import NiceModal, { useModal } from '@ebay/nice-modal-react';
import { defineModal } from '@/lib/modals';
import { FolderPickerDialog } from './FolderPickerDialog';

export interface RepoPickerDialogProps {
  value?: string;
  title?: string;
  description?: string;
}

type Stage = 'options' | 'existing' | 'new';

const RepoPickerDialogImpl = NiceModal.create<RepoPickerDialogProps>(
  ({ title: titleProp, description: descriptionProp }) => {
    const { t } = useTranslation(['settings', 'projects']);
    const title = titleProp ?? t('settings.projects.repoPicker.title');
    const description =
      descriptionProp ?? t('settings.projects.repoPicker.subtitle');
    const modal = useModal();
    const [stage, setStage] = useState<Stage>('options');
    const [error, setError] = useState('');
    const [isWorking, setIsWorking] = useState(false);

    // Stage: existing
    const [allRepos, setAllRepos] = useState<DirectoryEntry[]>([]);
    const [reposLoading, setReposLoading] = useState(false);
    const [showMoreRepos, setShowMoreRepos] = useState(false);
    const [loadingDuration, setLoadingDuration] = useState(0);
    const [hasSearched, setHasSearched] = useState(false);

    // Stage: new
    const [repoName, setRepoName] = useState('');
    const [parentPath, setParentPath] = useState('');

    useEffect(() => {
      if (modal.visible) {
        setStage('options');
        setError('');
        setAllRepos([]);
        setShowMoreRepos(false);
        setRepoName('');
        setParentPath('');
        setLoadingDuration(0);
        setHasSearched(false);
      }
    }, [modal.visible]);

    const loadRecentRepos = useCallback(async () => {
      setReposLoading(true);
      setError('');
      setLoadingDuration(0);
      try {
        const repos = await fileSystemApi.listGitRepos();
        setAllRepos(repos);
      } catch (err) {
        setError(t('settings.projects.repoPicker.errors.loadFailed'));
        console.error('Failed to load repos:', err);
      } finally {
        setReposLoading(false);
        setHasSearched(true);
      }
    }, [t]);

    useEffect(() => {
      if (
        stage === 'existing' &&
        allRepos.length === 0 &&
        !reposLoading &&
        !hasSearched
      ) {
        loadRecentRepos();
      }
    }, [stage, allRepos.length, reposLoading, hasSearched, loadRecentRepos]);

    // Track loading duration to show timeout message
    useEffect(() => {
      if (!reposLoading) {
        return;
      }

      const interval = setInterval(() => {
        setLoadingDuration((prev) => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    }, [reposLoading]);

    const registerAndReturn = async (path: string) => {
      setIsWorking(true);
      setError('');
      try {
        const repo = await repoApi.register({ path });
        modal.resolve(repo);
        modal.hide();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t('settings.projects.repoPicker.errors.registerFailed')
        );
      } finally {
        setIsWorking(false);
      }
    };

    const handleSelectRepo = (repo: DirectoryEntry) => {
      registerAndReturn(repo.path);
    };

    const handleBrowseForRepo = async () => {
      setError('');
      const selectedPath = await FolderPickerDialog.show({
        title: t('settings.projects.repoPicker.title'),
        description: t('settings.projects.repoPicker.browseTitle'),
      });
      if (selectedPath) {
        registerAndReturn(selectedPath);
      }
    };

    const handleCreateRepo = async () => {
      if (!repoName.trim()) {
        setError(t('settings.projects.repoPicker.errors.nameRequired'));
        return;
      }

      setIsWorking(true);
      setError('');
      try {
        const repo = await repoApi.init({
          parent_path: parentPath.trim() || '.',
          folder_name: repoName.trim(),
        });
        modal.resolve(repo);
        modal.hide();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t('settings.projects.repoPicker.errors.createFailed')
        );
      } finally {
        setIsWorking(false);
      }
    };

    const handleCancel = () => {
      modal.resolve(null);
      modal.hide();
    };

    const handleOpenChange = (open: boolean) => {
      if (!open && !isWorking) {
        handleCancel();
      }
    };

    const goBack = () => {
      setStage('options');
      setError('');
    };

    return (
      <div className="fixed inset-0 z-[10000] pointer-events-none [&>*]:pointer-events-auto">
        <Dialog open={modal.visible} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-[500px] w-full">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Stage: Options */}
              {stage === 'options' && (
                <>
                  <button
                    type="button"
                    className="w-full p-4 border cursor-pointer hover:shadow-md transition-shadow rounded-lg bg-card text-left"
                    onClick={() => setStage('existing')}
                  >
                    <div className="flex items-start gap-3">
                      <FolderGit className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">
                          {t('settings.projects.repoPicker.fromExisting')}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t('settings.projects.repoPicker.fromExistingDesc')}
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="w-full p-4 border cursor-pointer hover:shadow-md transition-shadow rounded-lg bg-card text-left"
                    onClick={() => setStage('new')}
                  >
                    <div className="flex items-start gap-3">
                      <FolderPlus className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">
                          {t('settings.projects.repoPicker.createNew')}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t('settings.projects.repoPicker.createNewDesc')}
                        </div>
                      </div>
                    </div>
                  </button>
                </>
              )}

              {/* Stage: Existing */}
              {stage === 'existing' && (
                <>
                  <button
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={goBack}
                    disabled={isWorking}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    {t('settings.projects.repoPicker.backToOptions')}
                  </button>

                  {reposLoading && (
                    <div className="p-4 border rounded-lg bg-card">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full" />
                        <div className="text-sm text-muted-foreground">
                          {loadingDuration < 2
                            ? t('projects:repoSearch.searching')
                            : t('projects:repoSearch.stillSearching', {
                                seconds: loadingDuration,
                              })}
                        </div>
                      </div>
                      {loadingDuration >= 3 && (
                        <div className="text-xs text-muted-foreground mt-2 ml-8">
                          {t('projects:repoSearch.takingLonger')}
                        </div>
                      )}
                    </div>
                  )}

                  {!reposLoading && allRepos.length > 0 && (
                    <div className="space-y-2">
                      {allRepos
                        .slice(0, showMoreRepos ? allRepos.length : 3)
                        .map((repo) => (
                          <button
                            key={repo.path}
                            type="button"
                            className="w-full p-4 border cursor-pointer hover:shadow-md transition-shadow rounded-lg bg-card text-left"
                            onClick={() => !isWorking && handleSelectRepo(repo)}
                            disabled={isWorking}
                          >
                            <div className="flex items-start gap-3">
                              <FolderGit className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground">
                                  {repo.name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate mt-1">
                                  {repo.path}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}

                      {!showMoreRepos && allRepos.length > 3 && (
                        <button
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                          onClick={() => setShowMoreRepos(true)}
                        >
                          {t('settings.projects.repoPicker.showMore', { count: allRepos.length - 3 })}
                        </button>
                      )}
                      {showMoreRepos && allRepos.length > 3 && (
                        <button
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                          onClick={() => setShowMoreRepos(false)}
                        >
                          {t('settings.projects.repoPicker.showLess')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* No repos found state */}
                  {!reposLoading &&
                    hasSearched &&
                    allRepos.length === 0 &&
                    !error && (
                      <div className="p-4 border rounded-lg bg-card">
                        <div className="flex items-start gap-3">
                          <Folder className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">
                              {t('projects:repoSearch.noReposFound')}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {t('projects:repoSearch.browseHint')}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  <button
                    type="button"
                    className="w-full p-4 border border-dashed cursor-pointer hover:shadow-md transition-shadow rounded-lg bg-card text-left"
                    onClick={() => !isWorking && handleBrowseForRepo()}
                    disabled={isWorking}
                  >
                    <div className="flex items-start gap-3">
                      <Search className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">
                          {t('settings.projects.repoPicker.browse')}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t('settings.projects.repoPicker.browseDesc')}
                        </div>
                      </div>
                    </div>
                  </button>
                </>
              )}

              {/* Stage: New */}
              {stage === 'new' && (
                <>
                  <button
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={goBack}
                    disabled={isWorking}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    {t('settings.projects.repoPicker.backToOptions')}
                  </button>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="repo-name">
                        {t('settings.projects.repoPicker.repoName')} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="repo-name"
                        type="text"
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value)}
                        placeholder="my-project"
                        disabled={isWorking}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('settings.projects.repoPicker.repoNameHint')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="parent-path">{t('settings.projects.repoPicker.parentDir')}</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="parent-path"
                          type="text"
                          value={parentPath}
                          onChange={(e) => setParentPath(e.target.value)}
                          placeholder="Current Directory"
                          className="flex-1"
                          disabled={isWorking}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isWorking}
                          onClick={async () => {
                            const selectedPath = await FolderPickerDialog.show({
                              title: t('settings.projects.repoPicker.selectParentDir'),
                              description:
                                t('settings.projects.repoPicker.selectParentDirDesc'),
                              value: parentPath,
                            });
                            if (selectedPath) {
                              setParentPath(selectedPath);
                            }
                          }}
                        >
                          <Folder className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.projects.repoPicker.parentDirHint')}
                      </p>
                    </div>

                    <Button
                      onClick={handleCreateRepo}
                      disabled={isWorking || !repoName.trim()}
                      className="w-full"
                    >
                      {isWorking ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('settings.projects.repoPicker.creating')}
                        </>
                      ) : (
                        t('settings.projects.repoPicker.createRepo')
                      )}
                    </Button>
                  </div>
                </>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isWorking && stage === 'existing' && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('settings.projects.repoPicker.registering')}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

export const RepoPickerDialog = defineModal<RepoPickerDialogProps, Repo | null>(
  RepoPickerDialogImpl
);
