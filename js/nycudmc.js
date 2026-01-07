// NYCUDMC Integration - Auto load DICOM files from cloud drive folder

(function() {
    'use strict';

    function getFolderIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('folderId') || urlParams.get('folder_id');
    }

    async function loadDicomFilesFromURLs(dicomFiles) {
        if (!ImageManager || !loadDicomDataSet) {
            console.error('Bluelight viewer not fully loaded');
            return;
        }

        console.log('Starting to load ' + dicomFiles.length + ' DICOM files...');

        ImageManager.NumOfPreLoadSops += dicomFiles.length;

        const loadPromises = dicomFiles.map(file => loadSingleDicomFile(file));
        await Promise.all(loadPromises);
    }

    async function loadSingleDicomFile(file) {
        try {
            const url = '/nycudmc/api/cloud_drive/download/' + file.uuid;
            console.log('Loading DICOM file: ' + file.name + ' from ' + url);

            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to download file: ' + file.name);
                ImageManager.NumOfPreLoadSops -= 1;
                return;
            }

            const arrayBuffer = await response.arrayBuffer();

            const Sop = loadDicomDataSet(arrayBuffer, false, url, true);
            
            if (Sop) {
                Sop.Image.url = url;
                setAllSeriesCount();
                ImageManager.preLoadSops.push({
                    dataSet: Sop.dataSet,
                    image: Sop.Image,
                    Sop: Sop,
                    SeriesInstanceUID: Sop.Image.SeriesInstanceUID,
                    Index: Sop.Image.NumberOfFrames | Sop.Image.InstanceNumber
                });
            }
            
            ImageManager.NumOfPreLoadSops -= 1;
            
            if (ImageManager.NumOfPreLoadSops == 0) {
                console.log('All DICOM files loaded, triggering loadPreLoadSops...');
                ImageManager.loadPreLoadSops();
            }
            
            console.log('Successfully loaded: ' + file.name);
        } catch (error) {
            console.error('Error loading DICOM file ' + file.name + ':', error);
            ImageManager.NumOfPreLoadSops -= 1;
            
            if (ImageManager.NumOfPreLoadSops == 0) {
                console.log('All files processed (with errors), triggering loadPreLoadSops...');
                ImageManager.loadPreLoadSops();
            }
        }
    }

    async function loadFolderFiles(folderId) {
        try {
            console.log('Loading files from folder: ' + folderId);
            
            const response = await fetch('/nycudmc/api/cloud_drive/list?folder_uuid=' + folderId);
            const data = await response.json();
            
            if (data.success && data.files && data.files.length > 0) {
                console.log('Found ' + data.files.length + ' files in folder ' + folderId);
                
                const dicomFiles = data.files.filter(f => 
                    !f.is_folder && (
                        f.name.toLowerCase().endsWith('.dcm') ||
                        f.name.toLowerCase().endsWith('.dicom')
                    )
                );
                
                if (dicomFiles.length > 0) {
                    console.log('Found ' + dicomFiles.length + ' DICOM files');
                    await loadDicomFilesFromURLs(dicomFiles);
                } else {
                    console.warn('No DICOM files found in folder ' + folderId);
                }
                
                const imgFiles = data.files.filter(f => 
                    !f.is_folder && (
                        f.name.toLowerCase().endsWith('.jpg') ||
                        f.name.toLowerCase().endsWith('.jpeg')
                    )
                );
                
                if (imgFiles.length > 0) {
                    console.log('Found ' + imgFiles.length + ' image files');
                    for (const imgFile of imgFiles) {
                        console.log('Found image file: ' + imgFile.name);
                        const downloadUrl = '/nycudmc/api/cloud_drive/download/' + imgFile.uuid;

                        try {
                            loadPicture(downloadUrl);
                            console.log('Loaded image file: ' + imgFile.name);
                        } catch (e) {
                            console.warn('Direct loadPicture(downloadUrl) failed, fetching blob as fallback:', e);
                            try {
                                const resp = await fetch(downloadUrl);
                                if (resp.ok) {
                                    const blob = await resp.blob();
                                    const blobUrl = URL.createObjectURL(blob);
                                    window.loadPicture = loadPicture;
                                    loadPicture(blobUrl);
                                    console.log('Loaded image file via blob: ' + imgFile.name);
                                } else {
                                    console.error('Failed to download image file: ' + imgFile.name);
                                }
                            } catch (err) {
                                console.error('Error fetching image file blob:', err);
                            }
                        }
                    }
                } else {
                    console.warn('No image files found in folder ' + folderId);
                }
                
            } else {
                console.warn('No files found in folder ' + folderId);
            }
        } catch (error) {
            console.error('Error loading folder files:', error);
        }
    }

    window.addEventListener('load', function() {
        const folderId = getFolderIdFromURL();
        
        if (folderId) {
            console.log('NYCUDMC: Auto-loading DICOM files from folder ID: ' + folderId);
            
            setTimeout(function() {
                loadFolderFiles(folderId);
            }, 1000);
        } else {
            console.log('NYCUDMC: No folder ID specified in URL');
        }
    });

    window.NYCUDMC = {
        loadFolderFiles: loadFolderFiles,
        getFolderIdFromURL: getFolderIdFromURL
    };

})();
