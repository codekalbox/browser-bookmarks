<?php
/**
 * Simple PHP script to save uploaded bookmark files to the /uploads/ folder.
 * Designed for Laragon/Localhost usage.
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $uploadsDir = __DIR__ . '/uploads';
    if (!is_dir($uploadsDir)) {
        mkdir($uploadsDir, 0777, true);
    }

    if (!empty($_FILES['files'])) {
        foreach ($_FILES['files']['name'] as $key => $name) {
            $tmpPath = $_FILES['files']['tmp_name'][$key];
            if ($tmpPath) {
                $uniqueName = date('Y-m-d_H-i-s') . '_' . basename($name);
                move_uploaded_file($tmpPath, $uploadsDir . '/' . $uniqueName);
            }
        }
        echo json_encode(['status' => 'success', 'message' => 'Files saved to /uploads/']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'No files received']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}
