<?php

if (!defined('BASEPATH'))
    exit('No direct script access allowed');

class Stripe extends OnlineAdmission_Controller
{

    public $pay_method = "";
    public $amount = 0;

    function __construct() {
        parent::__construct();
        $this->pay_method = $this->paymentsetting_model->getActiveMethod();
        $this->setting = $this->setting_model->getSetting();
        $this->amount = $this->setting->online_admission_amount;
        $this->load->library('stripe_payment');
        $this->load->library('mailsmsconf');
        $this->load->model('onlinestudent_model');

    }

    public function index() {

        $reference = $this->session->userdata('reference');
        $data['setting'] = $this->setting;
        
        $online_data = $this->onlinestudent_model->getAdmissionData($reference);
        $total = $this->amount;
        $data['amount'] = ($total);
        $data['name'] = $online_data->firstname." ".$online_data->lastname;
        $data['currency_name'] = $this->customlib->get_currencyShortName();
        
        $data['api_publishable_key'] = $this->pay_method->api_publishable_key;
        $this->load->view('onlineadmission/stripe/index', $data);
    }

      public function create_payment_intent()
    {
        // $params                        = $this->session->userdata('params');
        // $data                = $this->input->post();
        // $data['description'] = $this->lang->line("online_fees_deposit");
        // $data['currency']    = $params['invoice']->currency_name;

        $jsonStr = file_get_contents('php://input');
        $jsonObj = json_decode($jsonStr);
        
        $this->stripe_payment->PaymentIntent($jsonObj );
    }

    public function create_customer()
    {
        $jsonStr = file_get_contents('php://input');
        $jsonObj = json_decode($jsonStr);

        $user_detail = $this->session->userdata('params');
        $jsonObj->fullname = $user_detail['name'];
        $jsonObj->email = $user_detail['email'];
        $this->stripe_payment->AddCustomer($jsonObj);
    }


     public function insert_payment()
    {

        $jsonStr = file_get_contents('php://input');
        $jsonObj = json_decode($jsonStr);
        $return_response = $this->stripe_payment->InsertTransaction($jsonObj);
        if ($return_response['status']) {
            $payment = $return_response['payment'];
            // If transaction was successful
            if (!empty($payment) && $payment->status == 'succeeded') {
                $params              = $this->session->userdata('params');
                $data                =[];
                $data['description'] = $this->lang->line("online_fees_deposit");
                $data['currency']    = $params['invoice']->currency_name;
                // Retrieve transaction details
                $transaction_id = $payment->id;

                //=====================================


                $payment_data['transactionid'] = $transaction_id;
                $bulk_fees                     = array();


                foreach ($params['student_fees_master_array'] as $fee_key => $fee_value) {

                    $json_array = array(
                        'amount'          => $fee_value['amount_balance'],
                        'date'            => date('Y-m-d'),
                        'amount_discount' => 0,
                        'amount_fine'     => $fee_value['fine_balance'],
                        'description'     => $this->lang->line('online_fees_deposit_through_strip_txn_id') . $transaction_id,
                        'received_by'     => '',
                        'processing_charge_type'=>$params['processing_charge_type'],
                        'gateway_processing_charge'=>$params['gateway_processing_charge'],
                        'payment_mode'    => 'Stripe',
                    );

                    $insert_fee_data = array(
                        'fee_category'             => $fee_value['fee_category'],
                        'student_transport_fee_id' => $fee_value['student_transport_fee_id'],
                        'student_fees_master_id'   => $fee_value['student_fees_master_id'],
                        'fee_groups_feetype_id'    => $fee_value['fee_groups_feetype_id'],
                        'amount_detail'            => $json_array,
                    );

                    $bulk_fees[] = $insert_fee_data;
                    //========
                }
                $send_to  = $params['guardian_phone'];
                $response = $this->studentfeemaster_model->fee_deposit_bulk($bulk_fees, $send_to);
                //========================
                $student_id            = $this->customlib->getStudentSessionUserID();
                $student_current_class = $this->customlib->getStudentCurrentClsSection();
                $student_session_id    = $student_current_class->student_session_id;
                $fee_group_name        = [];
                $type                  = [];
                $code                  = [];

                $amount          = [];
                $fine_type       = [];
                $due_date        = [];
                $fine_percentage = [];
                $fine_amount     = [];

                $invoice     = [];

                $student = $this->student_model->getStudentByClassSectionID($student_current_class->class_id, $student_current_class->section_id, $student_id);

                if ($response && is_array($response)) {
                    foreach ($response as $response_key => $response_value) {
                        $fee_category = $response_value['fee_category'];
                        $invoice[]   = array(
                            'invoice_id'     => $response_value['invoice_id'],
                            'sub_invoice_id' => $response_value['sub_invoice_id'],
                            'fee_category' => $fee_category,
                        );

                        if ($response_value['student_transport_fee_id'] != 0 && $response_value['fee_category'] == "transport") {

                            $data['student_fees_master_id']   = null;
                            $data['fee_groups_feetype_id']    = null;
                            $data['student_transport_fee_id'] = $response_value['student_transport_fee_id'];

                            $mailsms_array     = $this->studenttransportfee_model->getTransportFeeMasterByStudentTransportID($response_value['student_transport_fee_id']);
                            $fee_group_name[]  = $this->lang->line("transport_fees");
                            $type[]            = $mailsms_array->month;
                            $code[]            = "-";
                            $fine_type[]       = $mailsms_array->fine_type;
                            $due_date[]        = $mailsms_array->due_date;
                            $fine_percentage[] = $mailsms_array->fine_percentage;
                            $fine_amount[]     = amountFormat($mailsms_array->fine_amount);
                            $amount[]          = amountFormat($mailsms_array->amount);
                        } else {

                            $mailsms_array = $this->feegrouptype_model->getFeeGroupByIDAndStudentSessionID($response_value['fee_groups_feetype_id'], $student_session_id);

                            $fee_group_name[]  = $mailsms_array->fee_group_name;
                            $type[]            = $mailsms_array->type;
                            $code[]            = $mailsms_array->code;
                            $fine_type[]       = $mailsms_array->fine_type;
                            $due_date[]        = $mailsms_array->due_date;
                            $fine_percentage[] = $mailsms_array->fine_percentage;
                            $fine_amount[]     = amountFormat($mailsms_array->fine_amount);

                            if ($mailsms_array->is_system) {
                                $amount[] = amountFormat($mailsms_array->balance_fee_master_amount);
                            } else {
                                $amount[] = amountFormat($mailsms_array->amount);
                            }
                        }
                    }
                    $obj_mail                     = [];
                    $obj_mail['student_id']  = $student_id;
                    $obj_mail['student_session_id'] = $student_session_id;

                    $obj_mail['invoice']         = $invoice;
                    $obj_mail['contact_no']      = $student['guardian_phone'];
                    $obj_mail['email']           = $student['email'];
                    $obj_mail['parent_app_key']  = $student['parent_app_key'];
                    $obj_mail['amount']          = "(" . implode(',', $amount) . ")";
                    $obj_mail['fine_type']       = "(" . implode(',', $fine_type) . ")";
                    $obj_mail['due_date']        = "(" . implode(',', $due_date) . ")";
                    $obj_mail['fine_percentage'] = "(" . implode(',', $fine_percentage) . ")";
                    $obj_mail['fine_amount']     = "(" . implode(',', $fine_amount) . ")";
                    $obj_mail['fee_group_name']  = "(" . implode(',', $fee_group_name) . ")";
                    $obj_mail['type']            = "(" . implode(',', $type) . ")";
                    $obj_mail['code']            = "(" . implode(',', $code) . ")";
                    $obj_mail['fee_category']    = $fee_category;
                    $obj_mail['send_type']    = 'group';

                    $this->mailsmsconf->mailsms('fee_submission', $obj_mail);
                }

                //=============================

          
                    echo json_encode(['status'=>1,'msg' => 'Transaction successful.','return_url'=>base_url("user/gateway/payment/successinvoice")]);

                //=====================================



            } else {
                http_response_code(500);
                echo json_encode(['status'=>0,'msg' => 'Transaction has been failed!','return_url'=>base_url('user/gateway/payment/paymentfailed')]);
            }
        } else {
            http_response_code(500);
            echo json_encode(['status'=>0,'msg' => $return_response['error']]);
        }
    }

    public function complete() {
        
        $stripeToken         = $this->input->post('stripeToken');
        $stripeTokenType     = $this->input->post('stripeTokenType');
        $stripeEmail         = $this->input->post('stripeEmail');
        $data                = $this->input->post();
        $data['stripeToken'] = $stripeToken;
        $data['total']  = $this->customlib->getGatewayProcessingFees($this->amount)+$this->amount;
        $data['description'] = $this->lang->line('online_admission_form_fees');
        $data['currency']    = $this->customlib->get_currencyShortName();
        $response            = $this->stripe_payment->payment($data);
  
        if ($response->isSuccessful()) {
            $transactionid = $response->getTransactionReference();
            $response      = $response->getData();
            if ($response['status'] == 'succeeded') {
                $amount = $this->session->userdata('payment_amount');
                $reference  = $this->session->userdata('reference');
                $online_data = $this->onlinestudent_model->getAdmissionData($reference);
                $apply_date=date("Y-m-d H:i:s");               
                
                $date         = date($this->customlib->getSchoolDateFormat(), $this->customlib->dateyyyymmddTodateformat(date("Y-m-d", strtotime($apply_date)))); 
                        
                $currentdate = date('Y-m-d');
                $adddata = array('id' => $reference, 'form_status' => 1, 'submit_date' => $currentdate);
                $this->onlinestudent_model->edit($adddata);
                
                $gateway_response['online_admission_id']   = $reference; 
                $gateway_response['paid_amount']    = $this->customlib->getGatewayProcessingFees($this->amount)+$this->amount;
                $gateway_response['transaction_id'] = $transactionid;
                $gateway_response['payment_mode']   = 'stripe';
                $gateway_response['payment_type']   = 'online';
                $gateway_response['processing_charge_type']   = $this->pay_method->charge_type;
            $gateway_response['processing_charge_value']   = $this->customlib->getGatewayProcessingFees($this->amount);
                $gateway_response['note']           = $this->lang->line('online_fees_deposit_through_stripe_txn_id')   . $transactionid;
                $gateway_response['date']           = date("Y-m-d H:i:s");
                $return_detail                      = $this->onlinestudent_model->paymentSuccess($gateway_response);
				 
                $sender_details = array('firstname' => $online_data->firstname, 'lastname' => $online_data->lastname, 'email' => $online_data->email,'date'=>$date,'reference_no'=>$online_data->reference_no,'mobileno'=>$online_data->mobileno,'paid_amount'=>$this->amount,'guardian_email'=>$online_data->guardian_email,'guardian_phone'=>$online_data->guardian_phone);
              
 $this->mailsmsconf->mailsms('online_admission_fees_submission', $sender_details);
                
                redirect(base_url("onlineadmission/checkout/successinvoice//".$online_data->reference_no));
            }
        } elseif ($response->isRedirect()) {
            $response->redirect();
        } else {
            redirect(site_url("onlineadmission/checkout/paymentfailed/".$online_data->reference_no));
        }
    }

}

?>