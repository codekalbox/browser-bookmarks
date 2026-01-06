<?php
/**
 * Simple PHP script to save/delete uploaded bookmark files.
 */

header('Content-Type: application/json');

$uploadsDir = __DIR__ . '/uploads';
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0777, true);
}

// ACTION: DELETE ALL
if (isset($_GET['action']) && $_GET['action'] === 'clear') {
    $files = glob($uploadsDir . '/*');
    foreach ($files as $file) {
        if (is_file($file)) {
            unlink($file);
        }
    }
    echo json_encode(['status' => 'success', 'message' => 'Uploads folder cleared']);
    exit;
}

// ACTION: UPLOAD
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!empty($_FILES['files'])) {
        $allowedExtensions = ['html', 'xml', 'json'];
        foreach ($_FILES['files']['name'] as $key => $name) {
            $tmpPath = $_FILES['files']['tmp_name'][$key];
            if ($tmpPath) {
                $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
                if (in_array($ext, $allowedExtensions)) {
                    $safeName = basename($name);
                    move_uploaded_file($tmpPath, $uploadsDir . '/' . $safeName);
                }
            }
        }
        echo json_encode(['status' => 'success', 'message' => 'Valid files saved to /uploads/']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'No files received']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}
