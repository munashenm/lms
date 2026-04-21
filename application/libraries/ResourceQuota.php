<?php

if (!defined('BASEPATH'))
    exit('No direct script access allowed');

class ResourceQuota
{

    private $CI; // CodeIgniter instance
    private $URL = 'https://eminenterp.com/api'; // Base API URL
    private $AUTH_KEY; // Authorization Key
    private $arr_resource = [
        'storage' => [
            "resource_id" => 15,
            "resource_name" => "Storage"
        ],
        'no_of_student' =>  [
            "resource_id" => 16,
            "resource_name" => "No of Student"
        ],
        'no_of_staff' =>   [
            "resource_id" => 17,
            "resource_name" => "No of Staff"
        ]
    ];

    function __construct()
    {
        $this->CI = &get_instance();
        $session_data=$this->CI->customlib->getLoggedInUserData();
        $this->AUTH_KEY =  $session_data['saas_key'];
    }

    public function getApplicationDetails()
    {
        $ch = curl_init();
        $url = $this->URL . '/user/resource-quota';
        curl_setopt($ch, CURLOPT_URL, $url);

        // Set options
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // Response is returned as a string

        // Add headers
        $headers = [
            'X-API-KEY: ' . $this->AUTH_KEY,
            'Content-Type: application/json'
        ];
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        // Set the request method
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');

        // Execute the request
        $response = curl_exec($ch);

        // Check for errors
        if (curl_errno($ch)) {
            curl_close($ch);
            return ['error' => curl_error($ch)];
        }

        // Get HTTP status code
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $decoded_response = json_decode($response, true);
        // Check if decoding was successful
        if (json_last_error() !== JSON_ERROR_NONE) {
            return ['error' => 'Failed to decode JSON response'];
        }

        // Add status code to the response
        $decoded_response['status_code'] = $http_code;

        return $decoded_response;
    }

    public function  getResourceLimit($params)
    {
        $details = $this->getApplicationDetails();

        if (isset($details['error'])) {


        } else {

            $return_data =  json_decode($this->findQuota($details, $params));

            return json_encode($return_data);
        }
    }

    public function findQuota($array, $find_resource = 'no_of_student')
    {
        $return_array = [];
        if ($array['status_code'] == 200) {
            foreach ($array['data'] as $array_key => $array_value) {

                if ($array_value['resource_name'] == $this->arr_resource[$find_resource]['resource_name']) {

                    $return_array['status'] = true;
                    $return_array['detail'] = $array_value;
                    break;
                }
            }
        } else {
            $return_array['status'] = false;
            $return_array['message'] = $array['message'];
        }
        return json_encode($return_array);
    }


    public function getQuotaSetting($find_resource = 'no_of_student')
    {
        return $this->arr_resource[$find_resource];
    }

    public function  updateResourceLimit($resource, $resource_usage,$action)
    {
        $resource_array = $this->getQuotaSetting($resource);
        $details = $this->updateApplicationDetails($resource_array['resource_id'], $resource_usage, $action);

        $return_array = [];
        if ($details['status_code'] == 200) {
            $return_array['status'] = true;
            $return_array['message'] = $details['message'];
        } else {
            $return_array['status'] = false;
            $return_array['message'] = $details['message'];
        }
        return json_encode($return_array);        
    }

    public function updateApplicationDetails($resource_id, $resource_usage, $action = "add")
    {    
        $data = [
            "resource_id" => $resource_id,
            "resource_usage" => $resource_usage,
            "action" => $action
        ];		
	

        // Convert payload to JSON
        $json_data = json_encode($data);


        $ch = curl_init();
        $url = $this->URL . '/user/resource-quota';

        // Set cURL options
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-API-KEY: ' . $this->AUTH_KEY,
            'Content-Type: application/json',
            'Content-Length: ' . strlen($json_data)
        ]);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json_data); // Attach the JSON body

        // Execute the request
        $response = curl_exec($ch);

        // Check for errors
        if (curl_errno($ch)) {
            curl_close($ch);
            return ['error' => curl_error($ch)];
        }

        // Get HTTP status code
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $decoded_response = json_decode($response, true);
        // Check if decoding was successful
        if (json_last_error() !== JSON_ERROR_NONE) {
            return ['error' => 'Failed to decode JSON response'];
        }

        // Add status code to the response
        $decoded_response['status_code'] = $http_code;

        return $decoded_response;
    }
}
