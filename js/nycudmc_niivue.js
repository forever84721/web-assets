(function() {
  'use strict';

  const loadingMessage = document.getElementById('loadingMessage');

  // Use window.nv and window.folderId (set by the template) so these globals
  // are accessible even when this file is loaded separately.
  async function initNiiVue() {
    try {
      // Initialize NiiVue and attach to canvas - store on window.nv
      window.nv = new niivue.Niivue();
      await window.nv.attachToCanvas(document.getElementById('niivueCanvas'));

      // Fetch file list from cloud_drive API
      const response = await fetch(`/nycudmc/api/cloud_drive/list?folder_uuid=${window.folderId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch file list');
      }

      const data = await response.json();
      if (loadingMessage) loadingMessage.style.display = 'none';

      if (data.success && data.files && data.files.length > 0) {
        displayFileList(data.files);

        // Auto-load first NIfTI or DICOM file
        const niiFiles = data.files.filter(f => {
          const name = (f.name || '').toLowerCase();
          return name.endsWith('.nii') || name.endsWith('.nii.gz') || name.endsWith('.dcm');
        });

        if (niiFiles.length > 0) {
          await loadNiiFile(niiFiles[0]);
        } else {
          if (loadingMessage) {
            loadingMessage.innerHTML = 'No NIfTI or DICOM files found in this folder';
            loadingMessage.style.display = 'block';
          }
        }
      } else {
        if (loadingMessage) {
          loadingMessage.innerHTML = 'No files found in this folder';
          loadingMessage.style.display = 'block';
        }
      }
    } catch (error) {
      console.error('Error initializing NiiVue:', error);
      if (loadingMessage) loadingMessage.innerHTML = 'Error loading viewer: ' + error.message;
    }
  }

  function displayFileList(files) {
    const fileListDiv = document.getElementById('fileList');
    const fileListContent = document.getElementById('fileListContent');

    const niiFiles = files.filter(f => {
      const name = (f.name || '').toLowerCase();
      return name.endsWith('.nii') || name.endsWith('.nii.gz') || name.endsWith('.dcm');
    });

    if (niiFiles.length === 0) {
      return;
    }

    fileListContent.innerHTML = '';
    niiFiles.forEach(file => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.textContent = file.name;
      fileItem.onclick = () => loadNiiFile(file);
      fileListContent.appendChild(fileItem);
    });

    fileListDiv.style.display = 'block';
    // Start collapsed
    fileListDiv.classList.add('collapsed');
  }

  async function loadNiiFile(file) {
    try {
      if (loadingMessage) {
        loadingMessage.innerHTML = `Loading ${file.name}...`;
        loadingMessage.style.display = 'block';
      }

      // Get download URL from cloud_drive API
      const downloadUrl = `/nycudmc/api/cloud_drive/download/${file.uuid}`;
      console.log('Downloading file from URL:', downloadUrl);

      const volumeList = [{
        url: downloadUrl,
        name: file.name
      }];

      const lower = (file.name || '').toLowerCase();
      if (lower.endsWith('.dcm')) {
        // Try to load DICOM. Some NiiVue builds may auto-detect DICOM via loadVolumes,
        // otherwise loadDicoms requires a configured dicom loader.
        try {
          await window.nv.loadVolumes(volumeList);
        } catch (dicomError) {
          console.error('DICOM loading error:', dicomError);
          if (loadingMessage) {
            loadingMessage.innerHTML =
              'DICOM support requires additional configuration. Please convert DICOM files to NIfTI format (.nii or .nii.gz) for viewing.';
            loadingMessage.style.display = 'block';
          }
          return;
        }
      } else {
        await window.nv.loadVolumes(volumeList);
      }

      if (loadingMessage) loadingMessage.style.display = 'none';

      // Highlight loaded file
      document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('loaded');
        if (item.textContent === file.name) {
          item.classList.add('loaded');
        }
      });
    } catch (error) {
      console.error('Error loading file:', error);
      if (loadingMessage) loadingMessage.innerHTML = 'Error loading file: ' + error.message;
    }
  }

  // ESC key to exit fullscreen
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const container = document.getElementById('niivueContainer');
      if (container && container.classList.contains('fullscreen')) {
        if (typeof window.toggleFullscreen === 'function') window.toggleFullscreen();
      }
    }
  });

  // Initialize when page loads
  window.addEventListener('load', initNiiVue);

  // Also expose helper functions if someone wants to call them
  // (these will be no-ops if the template already defines them)
  if (typeof window.toggleFileList !== 'function') {
    window.toggleFileList = function() {
      const fileList = document.getElementById('fileList');
      if (fileList) fileList.classList.toggle('collapsed');
    };
  }

  if (typeof window.toggleFullscreen !== 'function') {
    window.toggleFullscreen = function() {
      const container = document.getElementById('niivueContainer');
      const fullscreenBtn = document.getElementById('fullscreenBtn');
      const closeBtn = document.getElementById('closeFullscreenBtn');
      if (!container) return;
      if (container.classList.contains('fullscreen')) {
        container.classList.remove('fullscreen');
        if (fullscreenBtn) fullscreenBtn.style.display = 'block';
        if (closeBtn) closeBtn.classList.remove('show');
      } else {
        container.classList.add('fullscreen');
        if (fullscreenBtn) fullscreenBtn.style.display = 'none';
        if (closeBtn) closeBtn.classList.add('show');
      }
      const fileList = document.getElementById('fileList');
      if (fileList) {
        if (container.classList.contains('fullscreen')) {
          fileList.classList.add('fullscreen-mode');
        } else {
          fileList.classList.remove('fullscreen-mode');
        }
      }
      if (window.nv) {
        setTimeout(() => {
          if (typeof window.nv.resizeListener === 'function') window.nv.resizeListener();
        }, 100);
      }
    };
  }

})();
