// NYCUDMC Integration - Auto load DICOM files from cloud drive folder

(function() {
    'use strict';


    const loadingMessage = document.getElementById('loadingMessage');
    
    function toggleFullscreen() {
      const container = document.getElementById('niivueContainer');
      const fullscreenBtn = document.getElementById('fullscreenBtn');
      const closeBtn = document.getElementById('closeFullscreenBtn');
      
      if (container.classList.contains('fullscreen')) {
        container.classList.remove('fullscreen');
        fullscreenBtn.style.display = 'block';
        closeBtn.classList.remove('show');
      } else {
        container.classList.add('fullscreen');
        fullscreenBtn.style.display = 'none';
        closeBtn.classList.add('show');
      }
        // Toggle fileList position when entering/exiting fullscreen
        const fileList = document.getElementById('fileList');
        if (fileList) {
          if (container.classList.contains('fullscreen')) {
            fileList.classList.add('fullscreen-mode');
          } else {
            fileList.classList.remove('fullscreen-mode');
          }
        }
      // Resize NiiVue after fullscreen toggle
      if (nv) {
        setTimeout(() => nv.resizeListener(), 100);
      }
    }
    
    function toggleFileList() {
      const fileList = document.getElementById('fileList');
      fileList.classList.toggle('collapsed');
    }
    
    // ESC key to exit fullscreen
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const container = document.getElementById('niivueContainer');
        if (container.classList.contains('fullscreen')) {
          toggleFullscreen();
        }
      }
    });
    
    async function initNiiVue() {
      try {
        // Initialize NiiVue
        nv = new niivue.Niivue();
        await nv.attachToCanvas(document.getElementById('niivueCanvas'));
        
        // Fetch file list from cloud_drive API
        const response = await fetch(`/nycudmc/api/cloud_drive/list?folder_uuid=${folderId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch file list');
        }
        
        const data = await response.json();
        loadingMessage.style.display = 'none';
        
        if (data.success && data.files && data.files.length > 0) {
          displayFileList(data.files);
          
          // Auto-load first NIfTI file
          const niiFiles = data.files.filter(f => {
            const name = (f.name || '').toLowerCase();
            return name.endsWith('.nii') || name.endsWith('.nii.gz');
          });
          
          if (niiFiles.length > 0) {
            await loadNiiFile(niiFiles[0]);
          }else{
            loadingMessage.innerHTML = 'No NIfTI files found in this folder';
            loadingMessage.style.display = 'block';
          }
        } else {
          loadingMessage.innerHTML = 'No files found in this folder';
          loadingMessage.style.display = 'block';
        }
      } catch (error) {
        console.error('Error initializing NiiVue:', error);
        loadingMessage.innerHTML = 'Error loading viewer: ' + error.message;
      }
    }
    
    function displayFileList(files) {
      const fileListDiv = document.getElementById('fileList');
      const fileListContent = document.getElementById('fileListContent');
      
      const niiFiles = files.filter(f => {
        const name = (f.name || '').toLowerCase();
        return name.endsWith('.nii') || name.endsWith('.nii.gz');
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
        loadingMessage.innerHTML = `Loading ${file.name}...`;
        loadingMessage.style.display = 'block';
        
        // Get download URL from cloud_drive API
        const downloadUrl = `/nycudmc/api/cloud_drive/download/${file.uuid}`;
        console.log('Downloading NII file from URL:', downloadUrl);
        // Load the volume with name property so NiiVue can detect file type
        const volumeList = [{ 
          url: downloadUrl,
          name: file.name  // Add filename so NiiVue can detect .nii or .nii.gz extension
        }];
        await nv.loadVolumes(volumeList);
        
        loadingMessage.style.display = 'none';
        
        // Highlight loaded file
        document.querySelectorAll('.file-item').forEach(item => {
          item.classList.remove('loaded');
          if (item.textContent === file.name) {
            item.classList.add('loaded');
          }
        });
      } catch (error) {
        console.error('Error loading NII file:', error);
        loadingMessage.innerHTML = 'Error loading file: ' + error.message;
      }
    }
    
    // Initialize when page loads
    window.addEventListener('load', initNiiVue);
})();
