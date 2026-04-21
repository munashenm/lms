<?php

$currency_symbol = $this->customlib->getSchoolCurrencyFormat();
?>
<div class="content-wrapper">
    <div class="row">
        <div class="col-md-12">
            <section class="content-header">
                <h1>
                    <i class="fa fa-money"></i> <small></small>
                </h1>
            </section>
        </div>
    </div>
    <!-- /.control-sidebar -->
    <section class="content">
        <div class="row">
            <!-- left column -->
            <div class="col-md-12">
                <div class="box box-primary">
                    <div class="box-header">
                        <div class="row">
                            <div class="col-md-4">
                                <h3 class="box-title"><?php echo $this->lang->line('student_fees'); ?></h3>
                            </div>
                            <div class="col-md-8 ">
                                <div class="btn-group pull-right">
                                    <a href="<?php echo base_url() ?>user/user/dashboard" type="button" class="btn btn-primary btn-xs">
                                        <i class="fa fa-arrow-left"></i> <?php echo $this->lang->line('back'); ?></a>
                                </div>
                            </div>
                        </div>
                    </div><!--./box-header-->

                    <div class="box-body" style="padding-top:0;">
                        <div class="row">
                            <?php echo $this->session->flashdata('error');
                            $this->session->unset_userdata('error'); ?>
                            <?php if ($this->session->flashdata('msg')) {
                            ?>
                                <?php echo $this->session->flashdata('msg');
                                $this->session->unset_userdata('msg'); ?>
                            <?php } ?>

                            <div class="col-md-12">
                                <div class="sfborder-top-border">
                                    <div class="col-md-2">
                                        <?php if ($sch_setting->student_photo) {
                                        ?>
                                            <img width="115" height="115" class="mt5 mb10 sfborder-img-shadow img-responsive img-rounded" src="<?php
                                                                                                                                                if (!empty($student['image'])) {
                                                                                                                                                    echo base_url() . $student['image'] . img_time();
                                                                                                                                                } else {
                                                                                                                                                    echo base_url() . "uploads/student_images/no_image.png" . img_time();
                                                                                                                                                }
                                                                                                                                                ?>" alt="User profile picture">
                                        <?php
                                        } ?>
                                    </div>

                                    <div class="col-md-10">
                                        <div class="row">
                                            <table class="table table-striped mb0 font13">
                                                <tbody>
                                                    <tr>
                                                        <th class="bozero"><?php echo $this->lang->line('name'); ?></th>
                                                        <td class="bozero"><?php echo $this->customlib->getFullName($student['firstname'], $student['middlename'], $student['lastname'], $sch_setting->middlename, $sch_setting->lastname); ?></td>
                                                        <th class="bozero"><?php echo $this->lang->line('class_section'); ?></th>
                                                        <td class="bozero"><?php echo $student['class'] . " (" . $student['section'] . ")" ?> </td>
                                                    </tr>
                                                    <tr>
                                                        <?php if ($sch_setting->father_name) { ?>
                                                            <th><?php echo $this->lang->line('father_name'); ?></th>
                                                            <td><?php echo $student['father_name']; ?></td>
                                                        <?php }
                                                        ?>
                                                        <th><?php echo $this->lang->line('admission_no'); ?></th>
                                                        <td><?php echo $student['admission_no']; ?></td>
                                                    </tr>
                                                    <tr>
                                                        <?php if ($sch_setting->mobile_no) { ?>
                                                            <th><?php echo $this->lang->line('mobile_number'); ?></th>
                                                            <td><?php echo $student['mobileno']; ?></td>
                                                        <?php }
                                                        if ($sch_setting->roll_no) { ?>
                                                            <th><?php echo $this->lang->line('roll_number'); ?></th>
                                                            <td> <?php echo $student['roll_no']; ?> </td>
                                                        <?php } ?>
                                                    </tr>
                                                    <tr>
                                                        <?php if ($sch_setting->category) {
                                                        ?>
                                                            <th><?php echo $this->lang->line('category'); ?></th>
                                                            <td>
                                                                <?php
                                                                foreach ($categorylist as $value) {
                                                                    if ($student['category_id'] == $value['id']) {
                                                                        echo $value['category'];
                                                                    }
                                                                }
                                                                ?>
                                                            </td>
                                                        <?php }
                                                        if ($sch_setting->rte) { ?>
                                                            <th><?php echo $this->lang->line('rte'); ?></th>
                                                            <td><b class="text-danger"> <?php if(isset($student['rte'])){ echo $this->lang->line(strtolower($student['rte'])); } ?> </b>
                                                            </td>
                                                        <?php } ?>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-12">
                                <div style="background: #dadada; height: 1px; width: 100%; clear: both; margin-bottom: 10px;"></div>
                            </div>
                        </div>
                        <div class="row no-print mb10">
                            <div class="col-md-12 mDMb10">
                                <div class="float-rtl-right float-left">
                                    <a href="javascript:void(0)" class="btn btn-sm btn-info printSelected" data-loading-text="<i class='fa fa-spinner fa-spin '></i> <?php echo $this->lang->line('please_wait'); ?>"><i class="fa fa-print"></i> <?php echo $this->lang->line('print_selected'); ?> </a>
                                    <?php if ($payment_method) { ?>
                                        <button type="button" class="btn btn-sm btn-warning collectSelected" id="load" data-loading-text="<i class='fa fa-spinner fa-spin '></i> <?php echo $this->lang->line('please_wait') ?>"><i class="fa fa-money"></i> <?php echo $this->lang->line('pay_selected') ?></button>
                                    <?php } ?>
                                    <?php
                                    if ($student_processing_fee) { ?>
                                        <a href="#" class="btn btn-sm btn-info getProcessingfees" data-loading-text="<i class='fa fa-spinner fa-spin '></i> <?php echo $this->lang->line('please_wait') ?>"><i class="fa fa-money"></i> <?php echo $this->lang->line('processing_fees') ?></a>
                                    <?php
                                    }
                                    if ($sch_setting->is_offline_fee_payment) {
                                    ?>
                                        <button class="btn btn-sm btn-info getBankPayments" data-loading-text="<i class='fa fa-spinner fa-spin '></i> <?php echo $this->lang->line('please_wait') ?>"><i class="fa fa-money"></i> <?php echo $this->lang->line('offline_bank_payments') ?> </button>
                                    <?php } ?>
                                </div>
                                <span class="pull-right pt5"><?php echo $this->lang->line('date'); ?>: <?php echo date($this->customlib->getSchoolDateFormat()); ?></span>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <div class="download_label"><?php echo $this->lang->line('student_fees') . ": " . $student['firstname'] . " " . $student['lastname'] ?> </div>
                            <?php
                            if (empty($student_due_fee) && empty($transport_fees)) {
                            ?>
                                <div class="alert alert-danger">
                                    No fees Found.
                                </div>
                            <?php
                            } else {
                            ?>
                                <table class="table table-striped table-bordered table-hover  table-fixed-header">
                                    <thead>
                                        <tr>
                                            <th style="width: 10px"><input type="checkbox" id="select_all" /></th>
                                            <th class="text text-left"><?php echo $this->lang->line('fees'); ?></th>
                                            <!-- <th class="text text-left"><?php //echo $this->lang->line('fees_group'); ?></th> -->
                                            <!-- <th class="text text-left"><?php //echo $this->lang->line('fees_code'); ?></th> -->
                                            <th class="text text-left" class="text text-center"><?php echo $this->lang->line('due_date'); ?></th>
                                            <th class="text text-left" class="text text-left"><?php echo $this->lang->line('status'); ?></th>
                                            <th class="text text-right"><?php echo $this->lang->line('amount') ?> <span><?php echo "(" . $currency_symbol . ")"; ?></span></th>
                                            <th class="text text-left"><?php echo $this->lang->line('payment_id'); ?></th>
                                            <th class="text text-left"><?php echo $this->lang->line('mode'); ?></th>
                                            <th class="text text-left"><?php echo $this->lang->line('date'); ?></th>
                                            <th class="text text-right"><?php echo $this->lang->line('discount'); ?> <span><?php echo "(" . $currency_symbol . ")"; ?></span></th>
                                            <th class="text text-right"><?php echo $this->lang->line('fine'); ?> <span><?php echo "(" . $currency_symbol . ")"; ?></span></th>
                                            <th class="text text-right"><?php echo $this->lang->line('paid'); ?> <span><?php echo "(" . $currency_symbol . ")"; ?></span></th>
                                            <th class="text text-right"><?php echo $this->lang->line('balance'); ?> <span><?php echo "(" . $currency_symbol . ")"; ?></span></th>
                                            <th class="text text-right"><?php echo $this->lang->line('action'); ?></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php
                                        $total_amount           = 0;
                                        $total_deposite_amount  = 0;
                                        $total_fine_amount      = 0;
                                        $total_discount_amount  = 0;
                                        $total_balance_amount   = 0;
                                        $total_fees_fine_amount = 0;

                                        foreach ($student_due_fee as $key => $fee) {

                                            foreach ($fee->fees as $fee_key => $fee_value) {
												
												$fees_fine_amount = 0;
										
										
                                                $fee_paid          = 0;
                                                $fee_discount      = 0;
                                                $fee_fine          = 0;
                                                $alot_fee_discount = 0;

                                                if (!empty($fee_value->amount_detail)) {
                                                    $fee_deposits = json_decode(($fee_value->amount_detail));

                                                    foreach ($fee_deposits as $fee_deposits_key => $fee_deposits_value) {
                                                        $fee_paid     = $fee_paid + $fee_deposits_value->amount;
                                                        $fee_discount = $fee_discount + $fee_deposits_value->amount_discount;
                                                        $fee_fine     = $fee_fine + $fee_deposits_value->amount_fine;
                                                    }
                                                }

                                                if (($fee_value->due_date != "0000-00-00" && $fee_value->due_date != null) && (strtotime($fee_value->due_date) < strtotime(date('Y-m-d')))) {
                                                    //  $total_fees_fine_amount = $total_fees_fine_amount + $fee_value->fine_amount;

                                                    // get cumulative fine amount as delay days 
                                                    if ($fee_value->fine_type == 'cumulative') {
                                                        $date1 = date_create("$fee_value->due_date");
                                                        $date2 = date_create(date('Y-m-d'));
                                                        $diff = date_diff($date1, $date2);
                                                        $due_days = $diff->format("%a");;

                                                        if ($this->customlib->get_cumulative_fine_amount($fee_value->fee_groups_feetype_id, $due_days)) {
                                                            $due_fine_amount = $this->customlib->get_cumulative_fine_amount($fee_value->fee_groups_feetype_id, $due_days);
                                                        } else {
                                                            $due_fine_amount = 0;
                                                        }
                                                        $fees_fine_amount       = $due_fine_amount;
                                                        $total_fees_fine_amount = $total_fees_fine_amount + $due_fine_amount;
                                                    } else if ($fee_value->fine_type == 'fix' || $fee_value->fine_type == 'percentage') {
                                                        $fees_fine_amount       = $fee_value->fine_amount;
                                                        $total_fees_fine_amount = $total_fees_fine_amount + $fee_value->fine_amount;
                                                    }
                                                    // get cumulative fine amount as delay days

                                                }

                                                $total_amount          = $total_amount + $fee_value->amount;
                                                $total_discount_amount = $total_discount_amount + $fee_discount;
                                                $total_deposite_amount = $total_deposite_amount + $fee_paid;
                                                $total_fine_amount     = $total_fine_amount + $fee_fine;
                                                $feetype_balance       = $fee_value->amount - ($fee_paid + $fee_discount);
                                                $total_balance_amount  = $total_balance_amount + $feetype_balance;
                                        ?>
                                                <?php
                                                if ((!empty($fee_value->due_date)) && $feetype_balance > 0 && strtotime($fee_value->due_date) < strtotime(date('Y-m-d'))) {
                                                ?>
                                                    <tr class="danger font12">
                                                    <?php
                                                } else {
                                                    ?>
                                                    <tr class="dark-gray">
                                                    <?php
                                                }
                                                    ?>
                                                    <td><input class="checkbox" type="checkbox" name="fee_checkbox" data-fee_master_id="<?php echo $fee_value->id ?>" data-fee_session_group_id="<?php echo $fee_value->fee_session_group_id ?>" data-fee_groups_feetype_id="<?php echo $fee_value->fee_groups_feetype_id ?>" data-fee_category="fees" data-trans_fee_id="0"> </td>
                                                   <!--  <td align="left" class="text-rtl-right">
                                                        <?php
                                                        if ($fee_value->is_system) {
                                                            echo $this->lang->line($fee_value->name) . " (" . $this->lang->line($fee_value->type) . ")";
                                                        } else {
                                                            echo $fee_value->name . " (" . $fee_value->type . ")";
                                                        }
                                                        ?>
                                                    </td>
                                                    <td align="left" class="text-rtl-right">
                                                        <?php
                                                        if ($fee_value->is_system) {
                                                            echo $this->lang->line($fee_value->code);
                                                        } else {
                                                            echo $fee_value->code;
                                                        }

                                                        ?>
                                                    </td> -->

                                                     <td align="left" class="text-rtl-right">
                                                        <?php
                                                        if ($fee_value->is_system) {
                                                            echo $this->lang->line($fee_value->type) . " (" . $this->lang->line($fee_value->code) . ")";
                                                        } else {
                                                            echo $fee_value->type . " (" . $fee_value->code . ")";
                                                        }
                                                        ?>
                                                    </td>


                                                    <td align="left" class="text text-left">

                                                        <?php
                                                        if ($fee_value->due_date) {
                                                            echo date($this->customlib->getSchoolDateFormat(), $this->customlib->dateyyyymmddTodateformat($fee_value->due_date));
                                                        } else {
                                                        }
                                                        ?>
                                                    </td>
                                                    <td align="left" class="text text-left">
                                                        <?php
                                                        if ($feetype_balance == 0) {
                                                        ?><span class="label label-success"><?php echo $this->lang->line('paid'); ?></span><?php
                                                            } else if (!empty($fee_value->amount_detail)) {
                                                                     ?><span class="label label-warning"><?php echo $this->lang->line('partial'); ?></span><?php
                                                                                                                                                                                        } else {
                                                                                                                                                                                            ?><span class="label label-danger"><?php echo $this->lang->line('unpaid'); ?></span><?php
                                                                                                                                                                                        }
                                                                                                                                                                                            ?>
                                                    </td>
                                                    <td class="text text-right"><?php echo amountFormat($fee_value->amount);
                                                                                if (($fee_value->due_date != "0000-00-00" && $fee_value->due_date != null) && (strtotime($fee_value->due_date) < strtotime(date('Y-m-d')))) {
                                                                                ?>
                                                            <span data-toggle="popover" class="text text-danger detail_popover"><?php


                                                                                                                                echo " + " . (amountFormat($fees_fine_amount));

                                                                                                                                ?></span>
                                                            <div class="fee_detail_popover" style="display: none">
                                                                <?php
                                                                                    if ($fees_fine_amount != "") {
                                                                ?>
                                                                    <p class="text text-danger"><?php echo $this->lang->line('fine'); ?></p>
                                                                <?php
                                                                                    }
                                                                ?>
                                                            </div>
                                                        <?php
                                                                                }

                                                        ?>
                                                    </td>
                                                    <td class="text text-left"></td>
                                                    <td class="text text-left"></td>
                                                    <td class="text text-left"></td>
                                                    <td class="text text-right">
                                                        <?php
                                                                                echo amountFormat($fee_discount);
                                                                                ?>
                                                                                </td>
                                                    <td class="text text-right"><?php
                                                                                echo amountFormat($fee_fine);
                                                                                ?></td>
                                                    <td class="text text-right"><?php
                                                                                echo amountFormat($fee_paid);
                                                                                ?></td>
                                                    <td class="text text-right">
                                                        <?php
                                                        $display_none = "ss-none";
                                                        if ($feetype_balance > 0) {
                                                            $display_none = "";
                                                            echo amountFormat($feetype_balance);
                                                        }
                                                        ?>
                                                    </td>
                                                    <td  class="text text-right">
                                                        <div class="btn-group pull-right">
                                                            <?php
                                                            if ($feetype_balance > 0) {

                                                                if ($payment_method && $sch_setting->is_offline_fee_payment) {

                                                            ?>

                                                                    <form class="form_fees" action="<?php echo site_url('user/gateway/payment/pay'); ?>" method="POST">
                                                                        <input type="hidden" name="fee_category" value="fees">
                                                                        <input type="hidden" name="student_transport_fee_id" value="0">
                                                                        <input type="hidden" name="student_fees_master_id" value="<?php echo $fee->id; ?>">
                                                                        <input type="hidden" name="fee_groups_feetype_id" value="<?php echo $fee_value->fee_groups_feetype_id; ?>">
                                                                        <input type="hidden" name="student_id" value="<?php echo $student['id']; ?>">
                                                                        <input type="hidden" name="submit_mode" value="">
                                                                        <div class="dropdown">
                                                                            <button class="btn btn-xs btn-primary pull-right dropdown-toggle" type="button" data-toggle="dropdown"><i class="fa fa-money"></i> <?php echo $this->lang->line('pay'); ?>
                                                                                <span class="caret"></span></button>
                                                                            <ul class="dropdown-menu  dropdown-menu-right">
                                                                                <li><a href="#" data-student_id="<?php echo $student['id']; ?>" data-student_session_id="<?php echo $fee->student_session_id; ?>" data-toggle="modal" data-target="#myFeesModal" data-fee-category="fees" data-student_fees_master_id="<?php echo $fee->id; ?>" data-fee_groups_feetype_id="<?php echo $fee_value->fee_groups_feetype_id; ?>" data-group="<?php echo ($fee_value->is_system) ? $this->lang->line($fee_value->name) . " (" . $this->lang->line($fee_value->type) . ")" : $fee_value->name . " (" . $fee_value->type . ")"; ?>" data-type="<?php echo ($fee_value->is_system) ? $this->lang->line($fee_value->type) : $fee_value->code; ?>"><?php echo $this->lang->line('online_payment'); ?></a></li>
                                                                                <li><a href="javascript:void(0)" onclick="submitform('offline_payment',this)"><?php echo $this->lang->line('offline_payment'); ?></a></li>
                                                                            </ul>
                                                                        </div>
                                                                    </form>
                                                                <?php
                                                                } elseif ($payment_method) {
                                                                ?>

                                                                    <form class="form_fees" action="<?php echo site_url('user/gateway/payment/pay'); ?>" method="POST">
                                                                        <input type="hidden" name="fee_category" value="fees">
                                                                        <input type="hidden" name="student_transport_fee_id" value="0">
                                                                        <input type="hidden" name="student_fees_master_id" value="<?php echo $fee->id; ?>">
                                                                        <input type="hidden" name="fee_groups_feetype_id" value="<?php echo $fee_value->fee_groups_feetype_id; ?>">
                                                                        <input type="hidden" name="student_id" value="<?php echo $student['id']; ?>">
                                                                        <input type="hidden" name="submit_mode" value="online_payment">
                                                                        <button type="button" class="btn btn-xs btn-primary pull-right myCollectFeeBtn"  data-student_id="<?php echo $student['id']; ?>" data-student_session_id="<?php echo $fee->student_session_id; ?>" data-toggle="modal" data-target="#myFeesModal" data-fee-category="fees" data-student_fees_master_id="<?php echo $fee->id; ?>" data-fee_groups_feetype_id="<?php echo $fee_value->fee_groups_feetype_id; ?>" data-group="<?php echo ($fee_value->is_system) ? $this->lang->line($fee_value->name) . " (" . $this->lang->line($fee_value->type) . ")" : $fee_value->name . " (" . $fee_value->type . ")"; ?>" data-type="<?php echo ($fee_value->is_system) ? $this->lang->line($fee_value->type) : $fee_value->code; ?>"><i class="fa fa-money"></i> <?php echo $this->lang->line('pay'); ?></button>


                                                                        


                                                                    </form>
                                                                <?php

                                                                } elseif ($sch_setting->is_offline_fee_payment) {
                                                                ?>

                                                                    <form class="form_fees" action="<?php echo site_url('user/gateway/payment/pay'); ?>" method="POST">
                                                                        <input type="hidden" name="fee_category" value="fees">
                                                                        <input type="hidden" name="student_transport_fee_id" value="0">
                                                                        <input type="hidden" name="student_fees_master_id" value="<?php echo $fee->id; ?>">
                                                                        <input type="hidden" name="fee_groups_feetype_id" value="<?php echo $fee_value->fee_groups_feetype_id; ?>">
                                                                        <input type="hidden" name="student_id" value="<?php echo $student['id']; ?>">
                                                                        <input type="hidden" name="submit_mode" value="offline_payment">
                                                                        <button type="submit" class="btn btn-xs btn-primary pull-right myCollectFeeBtn"><i class="fa fa-money"></i> <?php echo $this->lang->line('pay'); ?></button>
                                                                    </form>
                                                            <?php

                                                                }
                                                            }
                                                            ?>
                                                        </div>
                                                    </td>
                                                    </tr>
                                                    <?php
                                                    if (!empty($fee_value->amount_detail)) {

                                                        $fee_deposits = json_decode(($fee_value->amount_detail));

                                                        foreach ($fee_deposits as $fee_deposits_key => $fee_deposits_value) {
                                                    ?>
                                                            <tr class="white-td">
                                                                <!-- <td align="left"></td> -->
                                                                <td align="left"></td>
                                                                <td align="left"></td>
                                                                <td align="left"></td>
                                                                <td align="left"></td>
                                                                <td class="text-right"><img src="<?php echo base_url(); ?>backend/images/table-arrow.png" alt="" /></td>
                                                                <td class="text text-left">

                                                                    <a href="#" data-toggle="popover" class="detail_popover"> <?php echo $fee_value->student_fees_deposite_id . "/" . $fee_deposits_value->inv_no; ?></a>
                                                                    <div class="fee_detail_popover" style="display: none">
                                                                        <?php
                                                                        if ($fee_deposits_value->description == "") {
                                                                        ?>
                                                                            <p class="text text-danger"><?php echo $this->lang->line('no_description'); ?></p>
                                                                        <?php
                                                                        } else {
                                                                        ?>
                                                                            <p class="text text-info"><?php echo $fee_deposits_value->description; ?></p>
                                                                        <?php
                                                                        }
                                                                        ?>
                                                                    </div>
                                                                </td>
                                                                <td class="text text-left"><?php echo $this->lang->line(strtolower($fee_deposits_value->payment_mode)); ?></td>
                                                                <td class="text text-left">

                                                                    <?php echo date($this->customlib->getSchoolDateFormat(), $this->customlib->dateyyyymmddTodateformat($fee_deposits_value->date)); ?>
                                                                </td>
                                                                <td class="text text-right"><a href="#" class="text text-right display-inline" title="<?php echo $this->lang->line('discount'); ?>" data-fee-deposite-id="<?php echo $fee_value->student_fees_deposite_id;?>" data-toggle="modal" data-target="#myfeeDiscountModal"><?php echo amountFormat($fee_deposits_value->amount_discount); ?></a></td>
                                                                <td class="text text-right"><?php echo amountFormat($fee_deposits_value->amount_fine); ?></td>
                                                                <td class="text text-right"><?php echo amountFormat($fee_deposits_value->amount); ?></td>
                                                                <td></td>
                                                                <td class="text text-right">
                                                                    <button class="btn btn-xs btn-default printDoc" data-main_invoice="<?php echo $fee_value->student_fees_deposite_id ?>" data-sub_invoice="<?php echo $fee_deposits_value->inv_no ?>" data-fee-category="fees" title="<?php echo $this->lang->line('print'); ?>"><i class="fa fa-print"></i> </button>
                                                                </td>
                                                            </tr>
                                                    <?php
                                                        }
                                                    }
                                                    ?>
                                            <?php
                                            }
                                        }
                                            ?>

                                            <?php

                                            if (!empty($transport_fees)) {
                                                foreach ($transport_fees as $transport_fee_key => $transport_fee_value) {

                                                    $fee_paid         = 0;
                                                    $fee_discount     = 0;
                                                    $fee_fine         = 0;
                                                    $fees_fine_amount = 0;
                                                    $feetype_balance  = 0;

                                                    if (!empty($transport_fee_value->amount_detail)) {
                                                        $fee_deposits = json_decode(($transport_fee_value->amount_detail));

                                                        foreach ($fee_deposits as $fee_deposits_key => $fee_deposits_value) {
                                                            $fee_paid     = $fee_paid + $fee_deposits_value->amount;
                                                            $fee_discount = $fee_discount + $fee_deposits_value->amount_discount;
                                                            $fee_fine     = $fee_fine + $fee_deposits_value->amount_fine;
                                                        }
                                                    }

                                                    $feetype_balance = $transport_fee_value->fees - ($fee_paid + $fee_discount);

                                                    if (($transport_fee_value->due_date != "0000-00-00" && $transport_fee_value->due_date != null) && (strtotime($transport_fee_value->due_date) < strtotime(date('Y-m-d')))) {
                                                        $fees_fine_amount       = is_null($transport_fee_value->fine_percentage) ? $transport_fee_value->fine_amount : percentageAmount($transport_fee_value->fees, $transport_fee_value->fine_percentage);
                                                        $total_fees_fine_amount = $total_fees_fine_amount + $fees_fine_amount;
                                                    }

                                                    $total_amount += $transport_fee_value->fees;
                                                    $total_discount_amount += $fee_discount;
                                                    $total_deposite_amount += $fee_paid;
                                                    $total_fine_amount += $fee_fine;
                                                    $total_balance_amount += $feetype_balance;

                                                    if (strtotime($transport_fee_value->due_date) < strtotime(date('Y-m-d'))) {
                                            ?>
                                                        <tr class="danger font12">
                                                        <?php
                                                    } else {
                                                        ?>
                                                        <tr class="dark-gray">
                                                        <?php
                                                    }
                                                        ?>
                                                        <td>
                                                            <input class="checkbox" type="checkbox" name="fee_checkbox" data-fee_master_id="0" data-fee_session_group_id="0" data-fee_groups_feetype_id="0" data-fee_category="transport" data-trans_fee_id="<?php echo $transport_fee_value->id; ?>">
                                                        </td>
                                                        
                                                        <!-- <td align="left" class="text-rtl-right"><?php //echo $this->lang->line('transport_fees'); ?></td>
                                                        <td align="left" class="text-rtl-right"><?php //echo $transport_fee_value->month; ?></td> -->

                                                        <td align="left" class="text-rtl-left"><?php echo $this->lang->line('transport_fees')." (".$transport_fee_value->month.")"; ?></td>

                                                        <td align="left" class="text text-left">
                                                            <?php echo $this->customlib->dateformat($transport_fee_value->due_date); ?> </td>
                                                        <td align="left" class="text text-left width85">
                                                            <?php
                                                            if ($feetype_balance == 0) {
                                                            ?><span class="label label-success"><?php echo $this->lang->line('paid'); ?></span><?php
                                                                                                                                            } else if (!empty($transport_fee_value->amount_detail)) {
                                                                                                                                                ?><span class="label label-warning"><?php echo $this->lang->line('partial'); ?></span><?php
                                                                                                                                                                                        } else {
                                                                                                                                                                                            ?><span class="label label-danger"><?php echo $this->lang->line('unpaid'); ?></span><?php
                                                                                                                                                                                        }
                                                                                                                                                                                            ?>
                                                        </td>
                                                        <td class="text text-right"><?php echo amountFormat($transport_fee_value->fees);

                                                                                    if (($transport_fee_value->due_date != "0000-00-00" && $transport_fee_value->due_date != null) && (strtotime($transport_fee_value->due_date) < strtotime(date('Y-m-d')))) {
                                                                                        $tr_fine_amount = $transport_fee_value->fine_amount;
                                                                                        if ($transport_fee_value->fine_type != "" && $transport_fee_value->fine_type == "percentage") {

                                                                                            $tr_fine_amount = percentageAmount($transport_fee_value->fees, $transport_fee_value->fine_percentage);
                                                                                        }
                                                                                    ?>
                                                                <span data-toggle="popover" class="text text-danger detail_popover"><?php echo " + " . (amountFormat($tr_fine_amount)); ?></span>
                                                                <div class="fee_detail_popover" style="display: none">
                                                                    <p class="text text-danger"><?php echo $this->lang->line('fine'); ?></p>
                                                                </div>
                                                            <?php
                                                                                    }

                                                            ?>
                                                        </td>
                                                        <td class="text text-left"></td>
                                                        <td class="text text-left"></td>
                                                        <td class="text text-left"></td>
                                                        <td class="text text-right">
                                                            <?php echo amountFormat($fee_discount); ?>
                                                        </td>
                                                        <td class="text text-right">
                                                            <?php echo amountFormat($fee_fine); ?>
                                                        </td>
                                                        <td class="text text-right">
                                                            <?php echo amountFormat($fee_paid); ?>
                                                        </td>
                                                        <td class="text text-right">
                                                            <?php
                                                            $display_none = "ss-none";
                                                            if ($feetype_balance > 0) {
                                                                $display_none = "";
                                                                echo amountFormat($feetype_balance);
                                                            }
                                                            ?>
                                                        </td>
                                                        <td  class="text text-right">
                                                            <?php

                                                            if ($feetype_balance > 0) {

                                                                if ($payment_method && $sch_setting->is_offline_fee_payment) {

                                                            ?>

                                                                    <form class="form_fees" action="<?php echo site_url('user/gateway/payment/pay'); ?>" method="POST">
                                                                        <input type="hidden" name="fee_category" value="transport">
                                                                        <input type="hidden" name="student_transport_fee_id" value="<?php echo $transport_fee_value->id; ?>">
                                                                        <input type="hidden" name="student_fees_master_id" value="0">
                                                                        <input type="hidden" name="fee_groups_feetype_id" value="0">
                                                                        <input type="hidden" name="student_id" value="<?php echo $student['id']; ?>">
                                                                        <input type="hidden" name="submit_mode" value="">
                                                                        <div class="dropdown">
                                                                            <button class="btn btn-xs btn-primary pull-right dropdown-toggle" type="button" data-toggle="dropdown"><i class="fa fa-money"></i> <?php echo $this->lang->line('pay'); ?>
                                                                                <span class="caret"></span></button>
                                                                            <ul class="dropdown-menu  dropdown-menu-right">


                                                                                <li><a href="#" data-student_id="<?php echo $student['id']; ?>" data-student_session_id="<?php echo $fee->student_session_id; ?>" data-toggle="modal" data-target="#myFeesModal" data-fee-category="transport" data-student_fees_master_id="0" data-fee_groups_feetype_id="0" data-trans_fee_id="<?php echo $transport_fee_value->id; ?>" data-group="<?php echo $this->lang->line('transport_fees'); ?>" data-type="<?php echo $transport_fee_value->month; ?>"><?php echo $this->lang->line('online_payment'); ?></a></li>




                                                                                <li><a href="javascript:void(0)" onclick="submitform('offline_payment',this)"><?php echo $this->lang->line('offline_payment'); ?></a></li>
                                                                            </ul>
                                                                        </div>
                                                                    </form>

                                                                <?php
                                                                } elseif ($payment_method) {
                                                                ?>

                                                                    <form class="form_fees" action="<?php echo site_url('user/gateway/payment/pay'); ?>" method="POST">
                                                                        <input type="hidden" name="fee_category" value="transport">
                                                                        <input type="hidden" name="student_transport_fee_id" value="<?php echo $transport_fee_value->id; ?>">
                                                                        <input type="hidden" name="student_fees_master_id" value="0">
                                                                        <input type="hidden" name="fee_groups_feetype_id" value="0">
                                                                        <input type="hidden" name="student_id" value="<?php echo $student['id']; ?>">
                                                                        <input type="hidden" name="submit_mode" value="online_payment">
                                                                        <button type="button" class="btn btn-xs btn-primary pull-right myCollectFeeBtn" data-student_id="<?php echo $student['id']; ?>" data-student_session_id="<?php echo $fee->student_session_id; ?>" data-toggle="modal" data-target="#myFeesModal" data-fee-category="transport" data-student_fees_master_id="0" data-fee_groups_feetype_id="0" data-trans_fee_id="<?php echo $transport_fee_value->id; ?>" data-group="<?php echo $this->lang->line('transport_fees'); ?>" data-type="<?php echo $transport_fee_value->month; ?>"><i class="fa fa-money"></i> <?php echo $this->lang->line('pay'); ?></button>
                                                                    </form>
                                                                <?php
                                                                } elseif ($sch_setting->is_offline_fee_payment) {
                                                                ?>

                                                                    <form class="form_fees" action="<?php echo site_url('user/gateway/payment/pay'); ?>" method="POST">
                                                                        <input type="hidden" name="fee_category" value="transport">
                                                                        <input type="hidden" name="student_transport_fee_id" value="<?php echo $transport_fee_value->id; ?>">
                                                                        <input type="hidden" name="student_fees_master_id" value="0">
                                                                        <input type="hidden" name="fee_groups_feetype_id" value="0">
                                                                        <input type="hidden" name="student_id" value="<?php echo $student['id']; ?>">
                                                                        <input type="hidden" name="submit_mode" value="offline_payment">
                                                                        <button type="submit" class="btn btn-xs btn-primary pull-right myCollectFeeBtn"><i class="fa fa-money"></i> <?php echo $this->lang->line('pay'); ?></button>
                                                                    </form>
                                                            <?php
                                                                }
                                                            }
                                                            ?>
                                                        </td>
                                                        </tr>
                                                        <?php
                                                        if (!empty($transport_fee_value->amount_detail)) {

                                                            $fee_deposits = json_decode(($transport_fee_value->amount_detail));

                                                            foreach ($fee_deposits as $fee_deposits_key => $fee_deposits_value) {
                                                        ?>
                                                                <tr class="white-td">
                                                                    <!-- <td align="left"></td> -->
                                                                    <td align="left"></td>
                                                                    <td align="left"></td>
                                                                    <td align="left"></td>
                                                                    <td align="left"></td>
                                                                    <td class="text-right"><img src="<?php echo base_url(); ?>backend/images/table-arrow.png" alt="" /></td>
                                                                    <td class="text text-left">
                                                                        <a href="#" data-toggle="popover" class="detail_popover"> <?php echo $transport_fee_value->student_fees_deposite_id . "/" . $fee_deposits_value->inv_no; ?></a>
                                                                        <div class="fee_detail_popover" style="display: none">
                                                                            <?php
                                                                            if ($fee_deposits_value->description == "") {
                                                                            ?>
                                                                                <p class="text text-danger"><?php echo $this->lang->line('no_description'); ?></p>
                                                                            <?php
                                                                            } else {
                                                                            ?>
                                                                                <p class="text text-info"><?php echo $fee_deposits_value->description; ?></p>
                                                                            <?php
                                                                            }
                                                                            ?>
                                                                        </div>
                                                                    </td>
                                                                    <td class="text text-left"><?php echo $this->lang->line(strtolower($fee_deposits_value->payment_mode)); ?></td>
                                                                    <td class="text text-left">

                                                                        <?php echo date($this->customlib->getSchoolDateFormat(), $this->customlib->dateyyyymmddTodateformat($fee_deposits_value->date)); ?> 
                                                                    </td>
                                                                    <td class="text text-right"><a href="#" class="text text-right display-inline" title="<?php echo $this->lang->line('discount'); ?>" data-fee-deposite-id="<?php echo $transport_fee_value->student_fees_deposite_id;?>" data-toggle="modal" data-target="#myfeeDiscountModal"><?php echo amountFormat($fee_deposits_value->amount_discount); ?></a></td>
                                                                    <td class="text text-right"><?php echo amountFormat($fee_deposits_value->amount_fine); ?></td>
                                                                    <td class="text text-right"><?php echo amountFormat($fee_deposits_value->amount); ?></td>
                                                                    <td></td>
                                                                    <td class="text text-right">
                                                                        <button class="btn btn-xs btn-default printDoc" data-main_invoice="<?php echo $transport_fee_value->student_fees_deposite_id ?>" data-sub_invoice="<?php echo $fee_deposits_value->inv_no ?>" data-fee-category="transport" title="<?php echo $this->lang->line('print'); ?>"><i class="fa fa-print"></i> </button>
                                                                    </td>
                                                                </tr>
                                                        <?php
                                                            }
                                                        }
                                                        ?>
                                                <?php
                                                }
                                            }

                                                ?>
                                          
                                                <tr class="box box-solid total-bg">
                                                    <!-- <td align="left"></td> -->
                                                    <td align="left"></td>
                                                    <td align="left"></td>
                                                    <td align="left"></td>
                                                    <td align="left" class="text text-left"><?php echo $this->lang->line('grand_total'); ?></td>
                                                    <td class="text text-right">
                                                        <?php
                                                        echo $currency_symbol . amountFormat($total_amount);
                                                        ?>
                                                        <span data-toggle="popover" class="text text-danger detail_popover"><?php echo " + " . (amountFormat($total_fees_fine_amount)); ?></span>

                                                        <div class="fee_detail_popover" style="display: none">

                                                            <p class="text text-danger"><?php echo $this->lang->line('fine'); ?></p>

                                                        </div>
                                                    </td>
                                                    <td class="text text-left"></td>
                                                    <td class="text text-left"></td>
                                                    <td class="text text-left"></td>
                                                    <td class="text text-right"><?php
                                                                                echo $currency_symbol . amountFormat($total_discount_amount);
                                                                                ?></td>
                                                    <td class="text text-right"><?php
                                                                                echo $currency_symbol . amountFormat($total_fine_amount);
                                                                                ?></td>
                                                    <td class="text text-right"><?php
                                                                                echo $currency_symbol . amountFormat($total_deposite_amount);
                                                                                ?></td>
                                                    <td class="text text-right"><?php
                                                                                echo $currency_symbol . amountFormat($total_balance_amount);
                                                                                ?></td>
                                                    <td class="text text-right"></td>
                                                </tr>
                                    </tbody>
                                </table>
                            <?php } ?>
                        </div>
                    </div>
                    <!-- /.box-body -->
                </div>
            </div>
            <!--/.col (left) -->
        </div>
    </section>
</div>

<div class="modal fade" id="myfeeDiscountModal" role="dialog">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal">&times;</button>
                <h4 class="modal-title title text-center fees_discount_title"></h4>
            </div>
            <div class="modal-body minheight260"> 

                <div class="modal_loader_div" style="display: none;"></div>

                <div class="modal-body-inner">
                    
                </div>

                </div>
        </div>
    </div>
</div>


<div class="modal fade" id="myFeesModal" role="dialog">
    <div class="modal-dialog" style="<?php  if ($sch_setting->fees_discount) { ?> width:50% <?php } ?>"  >
        <div class="modal-content">

            <!-- <form class="form_fees" action="<?php //echo site_url('user/gateway/payment/pay'); ?>" onsubmit="return validate_amount();" method="POST"> -->
            <form class="form_fees" id="myformnew" action="<?php echo site_url('user/gateway/payment/pay'); ?>"  method="POST">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal">&times;</button>
                    <h4 class="modal-title title text-center fees_title"></h4>
                </div>

                <div class="modal-body minheight170">
                <div class="modal_inner_loader" style="display: block;"></div>
                    <div class="form-horizontal balanceformpopup">
                        <div class="box-body pr-0 pl-0">				 
							
							<?php 
							if ($sch_setting->fees_discount) {        
								$t1 = 3;  	$t2 = 9;		
							} else { 
								$t1 = 6;	$t2 = 6; 
							} 
							?>
							
                            <input type="hidden" name="fee_category" value="">
                            <input type="hidden" name="student_transport_fee_id" value="0">
                            <input type="hidden" name="student_fees_master_id" value="0">
                            <input type="hidden" name="fee_groups_feetype_id" value="0">
                            <input type="hidden" name="student_id" value="0">
                            <input type="hidden" name="fee_discount" value="0">
                            <input type="hidden" name="final_amount" value="0">
                            <input type="hidden" name="submit_mode" value="0">
                            <input type="hidden" name="amount" value="0">
							
                            <div class="row">
                            <dt class="col-sm-<?php echo $t1; ?> col-xs-6"><?php echo $this->lang->line('date'); ?></dt>
                            <dd class="col-sm-<?php echo $t2; ?> col-xs-6"><?php echo date($this->customlib->getSchoolDateFormat()); ?></dd>
                            </div>
                            <div class="row">
                            <dt class="col-sm-<?php echo $t1; ?> col-xs-6"><?php echo $this->lang->line('fees');//$this->lang->line('amount'); ?> (<?php echo $currency_symbol; ?>)</dt>
                            <dd class="col-sm-<?php echo $t2; ?> col-xs-6"><span class="modal_amount">0</span></dd>
                            </div>
                            <div class="row">
                            <dt class="col-sm-<?php echo $t1; ?> col-xs-6"><?php echo $this->lang->line('fine'); ?> (<?php echo $currency_symbol; ?>)</dt>
                            <dd class="col-sm-<?php echo $t2; ?> col-xs-6"><span class="modal_fine_amount">0</span></dd>
                            </div>

                           <!-- old code <div class="form-group" >
                                <label for="inputPassword3" class="col-sm-3 control-label"> <?php //echo $this->lang->line('discount_group'); ?></label>
                                <div class="col-sm-9">
                                    <select class="form-control modal_discount_group" id="discount_group" name="student_fees_discount_id">
                                        <option value=""><?php //echo $this->lang->line('select'); ?></option>
                                    </select>
                                    <span class="text-danger" id="amount_error"></span>
                                </div>
                            </div> -->

                        <?php  if ($sch_setting->fees_discount) { ?>
                            <div class="row">
                             <dt class="col-sm-<?php echo $t1; ?> col-xs-6"><?php echo $this->lang->line('discount'); ?> </dt>
                             <dd class="col-sm-<?php echo $t2; ?> col-xs-6" id="set_discount_details"></dd>
                            </div>                      
                            <div class="row">
                            <dt class="col-sm-<?php echo $t1; ?> col-xs-6"><?php echo $this->lang->line('discount'); ?> (<?php echo $currency_symbol; ?>)</dt>
                            <dd class="col-sm-<?php echo $t2; ?> col-xs-6"><span class="modal_discount_amount" >0</span>
                            </dd>
                            </div>
                        <?php } ?>

                            <div class="row">
                            <dt class="col-sm-<?php echo $t1; ?> col-xs-6"><?php echo $this->lang->line('paying_amount'); ?> (<?php echo $currency_symbol; ?>)</dt>
                            <dd class="col-sm-<?php echo $t2; ?> col-xs-6">
                                <span class="modal_final_amount">0</span>
                                <br>
                                <span class="text-danger error" id="fees_amount_error"></span>
                            </dd>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default pull-left" data-dismiss="modal"><?php echo $this->lang->line('cancel'); ?></button>
                <button type="button" class="btn cfees save_button" > <?php echo $currency_symbol; ?> <?php echo $this->lang->line('pay'); ?> </button>
                    <!-- <button type="button" class="btn cfees save_button" onclick="submitform('online_payment',this)"><?php echo $currency_symbol; ?><?php echo $this->lang->line('pay'); ?> </button> -->
                </div>
            </form>
        </div>
    </div>
</div>



<div id="bank_payment_modal" class="modal fade">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h4 class="modal-title"><?php echo $this->lang->line('offline_bank_payments'); ?></h4>
            </div>
            <div class="modal-body scroll-area">
            </div>
        </div>
    </div>
</div>


<div id="listCollectionModal" class="modal fade">
    <div class="modal-dialog">
        <form action="<?php echo site_url('user/gateway/payment/grouppay'); ?>" method="POST" id="collect_fee_group">
            <div class="modal-content">
                <!-- //================ -->
                <input type="hidden" class="form-control" id="group_std_id" name="student_session_id" value="<?php echo $student["student_session_id"]; ?>" readonly="readonly" />
                <input type="hidden" class="form-control" id="group_parent_app_key" name="parent_app_key" value="<?php echo $student['parent_app_key'] ?>" readonly="readonly" />
                <input type="hidden" class="form-control" id="group_guardian_phone" name="guardian_phone" value="<?php echo $student['guardian_phone'] ?>" readonly="readonly" />
                <input type="hidden" class="form-control" id="group_guardian_email" name="guardian_email" value="<?php echo $student['guardian_email'] ?>" readonly="readonly" />
                <!-- //================ -->
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                    <h4 class="modal-title"><?php echo $this->lang->line('pay_fees'); ?></h4>
                </div>
                <div class="modal-body">
                </div>
            </div>
        </form>
    </div>
</div>

<div id="processing_fess_modal" class="modal fade">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h4 class="modal-title"><?php echo $this->lang->line('processing_fees'); ?></h4>
            </div>
            <div class="modal-body scroll-area">
            </div>
        </div>
    </div>
</div>

<div id="bank_payment_modal" class="modal fade">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <h4 class="modal-title"><?php echo $this->lang->line('offline_bank_payments'); ?></h4>
            </div>
            <div class="modal-body scroll-area">
            </div>
        </div>
    </div>
</div>

<div id="myPaymentModel" class="modal fade">
    <div class="modal-dialog modal-lg">
        <!-- Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal">&times;</button>
                <h4 class="modal-title"><?php echo $this->lang->line('payment_details'); ?> </h4>
            </div>
            <div class="modal-body modalminheight">
                <div class="modal_inner_loader"></div>
                <div class="payment_detail" id="media_div">
                </div>
            </div><!-- ./row -->
        </div>
    </div>
</div>



<script type="text/javascript">

    
$("#myfeeDiscountModal").on('hidden.bs.modal', function (e) {
   
   $('#myfeeDiscountModal .modal-body .modal-body-inner').html("");  
});


$("#myfeeDiscountModal").on('shown.bs.modal', function (e) {
        e.stopPropagation();
        $('.fees_discount_title').html("<?php echo $this->lang->line('discount'); ?>");
        var student_fees_deposite = $(e.relatedTarget).data('feeDepositeId');
       
        var modal_discount = $(this);
        $.ajax({
            type: "post",
            url: base_url+"user/user/getAppliedDiscounts",
            dataType: 'JSON',
            data: {'student_fees_deposite': student_fees_deposite
            },
            beforeSend: function () {
                fee_type_amount=0;
                        $('#myfeeDiscountModal .modal-body .modal-body-inner').html(""); 
                        $('#myfeeDiscountModal .modal-body .modal_loader_div').css("display", "block"); 
            },
            success: function (response) {
                if(response.status){
             
                    $('#myfeeDiscountModal .modal-body .modal-body-inner').html(response.page); 
                    $('#myfeeDiscountModal .modal-body .modal_loader_div').fadeOut(400);
                }

            },
            error: function (xhr) { // if error occured
                alert("<?php echo $this->lang->line('error_occurred_please_try_again'); ?>");

            },
            complete: function () { 
            }
        });
    });


//old code start
   /* var fee_amount = 0;
    var fine_amount = 0;
    $(function() {
        let a = "";
        $(document).on('change', "#discount_group", function() {
            var amount = isNaN($('option:selected', this).data('disamount')) ? 0 : $('option:selected', this).data('disamount');
            var type = $('option:selected', this).data('type');
            var percentage = $('option:selected', this).data('percentage');
            let balance_amount = 0;
            let discount = 0;
            
            if (type == null || type == "fix") {
                discount = parseFloat(amount);
                balance_amount = ((parseFloat(fee_amount) - parseFloat(amount)) + parseFloat(fine_amount)).toFixed(2);
            } else if (type == "percentage") {
                var per_amount = ((parseFloat(fee_type_amount) * parseFloat(percentage)) / 100).toFixed(2);
                discount = parseFloat(per_amount);
                balance_amount = ((parseFloat(fee_amount) - per_amount) + parseFloat(fine_amount)).toFixed(2);
            } else {
                balance_amount = ((parseFloat(fee_amount) - parseFloat(amount)) + parseFloat(fine_amount)).toFixed(2);
            }

            $('#myFeesModal input[name="fee_discount"]').val(discount);
            if (typeof amount !== typeof undefined && amount !== false) {
                $('div#myFeesModal').find('.modal_discount_amount').html((type == "percentage") ? per_amount : amount);
                $('div#myFeesModal .modal_final_amount').html(balance_amount);
                $('div#myFeesModal').find('input#amount').val(balance_amount);
            } else {
                $('div#myFeesModal').find('input#amount').val(fee_amount);
                $('div#myFeesModal .modal_final_amount').html(fee_amount);
                $('div#myFeesModal').find('.modal_discount_amount').html(0);
            }
        });
    }); */
    //old code end


    $("#myFeesModal").on('shown.bs.modal', function(e) {
        e.stopPropagation();
        // var discount_group_dropdown = '<option value=""><?php echo $this->lang->line('select'); ?></option>'; //old code
        var discount_group_dropdown = '';
        var data = $(e.relatedTarget).data();

        var modal = $(this);
        var type = data.type;
        var amount = data.amount;
        var group = data.group;
        var fee_groups_feetype_id = data.fee_groups_feetype_id;
        var student_fees_master_id = data.student_fees_master_id;
        var student_session_id = data.student_session_id;
        var student_id = data.student_id;
        var fee_category = data.feeCategory;
        var trans_fee_id = data.trans_fee_id;

        $('#myFeesModal .modal_final_amount').html('0');
        $('.fees_title').html("");
        $('.fees_title').html("<b>" + group + ":</b> " + type);
        $('#myFeesModal input[name="fee_groups_feetype_id"]').val(fee_groups_feetype_id);
        $('#myFeesModal input[name="student_fees_master_id"]').val(student_fees_master_id);
        $('#myFeesModal input[name="student_transport_fee_id"]').val(trans_fee_id);
        $('#myFeesModal input[name="student_id"]').val(student_id);
        $('#myFeesModal input[name="fee_category"]').val(fee_category);

        $.ajax({
            type: "post",
            url: '<?php echo site_url("user/user/geBalanceFee") ?>',
            dataType: 'JSON',
            data: {
                'fee_groups_feetype_id': fee_groups_feetype_id,
                'student_fees_master_id': student_fees_master_id,
                'student_session_id': student_session_id,
                'fee_category': fee_category,
                'trans_fee_id': trans_fee_id
            },
            beforeSend: function() {
                $('#myFeesModal .modal-body .modal_inner_loader').css("display", "block"); 
                $('#discount_group').html("");
                $("span[id$='_error']").html("");
                $('#set_discount_details').html(""); //new line added
                $('#myFeesModal .modal_discount_amount').html("0");
                $('#myFeesModal .modal_amount').html("0");
                $('#myFeesModal .modal_fine_amount').html("0");
                $('#myFeesModal .modal_final_amount').html("0");
            },
            success: function(data) {

                if (data.status === "success") {
                    fee_amount = data.balance;
                    fine_amount = data.remain_amount_fine;
                    // fee_type_amount = data.student_fees; //old code
                    fee_type_amount=data.balance; //new line added

                    $('#myFeesModal .modal_amount').html(data.balance);
                    $('#myFeesModal .modal_fine_amount').html(data.remain_amount_fine);
                    $('#myFeesModal .modal_final_amount').html((parseFloat(data.balance) + parseFloat(data.remain_amount_fine))); 
                    $('#myFeesModal input[name="amount"]').val(data.balance); //new line added

                    //old code
                    // $.each(data.discount_not_applied, function(i, obj) {
                    //     discount_group_dropdown += "<option value=" + obj.student_fees_discount_id + " data-disamount=" + obj.amount + " data-type=" + obj.type + " data-percentage=" + obj.percentage + ">" + obj.code + "</option>";
                    // });
                    // $('#discount_group').append(discount_group_dropdown);
                    //old code

                    var currency_symbol="<?php echo $currency_symbol;?>";
                    var discount_id=0;
                    var disamount=0;
                    var disamount_type=0;
                    var disamount_percentage=0;
                    var disamount_text=0;
                    var disamount_remaining_discount_limit=0;
                    var disamount_last_colum=0;

                    if(data.discount_not_applied.length>0){

                    $.each(data.discount_not_applied, function(i, obj) {
                        discount_id=obj.id;
                        disamount=(obj.type== 'fix') ? (obj.amount) : 0 ;
                        disamount_type=obj.type;
                        disamount_percentage= (obj.type == 'percentage') ?  (obj.percentage): 0;
                        disamount_text=obj.name+" ("+obj.code+")";
                        disamount_remaining_discount_limit=obj.remaining_discount_limit;
                        disamount_last_colum=  (obj.type== 'fix') ?  currency_symbol+obj.amount : obj.percentage+"%"; 

                        discount_group_dropdown += `
                        <div class="row">
                        <div class="col-md-7">
                        <label class="checkbox-inline pt0">
                        <input type="checkbox" name="fee_discount_group[]" 
                        class="grp_discount" 
                        value="${discount_id}" 
                        data-disamount="${disamount}" 
                        data-type="${disamount_type}"
                        data-percentage="${disamount_percentage}"
                        name="student_fees_discount_id"
                        id="discount_group"
                        >
                        ${disamount_text} 
                        </label>
                        </div>
                        <div class="col-md-3 text text-center">${disamount_remaining_discount_limit}</div>
                        <div class="col-md-2 text text-right">
                      ${disamount_last_colum} 
                        </div>
                        </div>`;
                    });

                    var discount_table=`
                    <div class="checkbox-fees-scroll">
                                <div class="row">
                                    <div class="col-md-12">
                                        <div class="row">
                                            <div class="col-md-7"><strong><?php echo $this->lang->line("fees_discount") ?></strong></div>
                                            <div class="col-md-3 text text-center"><strong><?php echo $this->lang->line("available_count") ?></strong></div>
                                            <div class="col-md-2 text text-right"><strong><?php echo $this->lang->line("value") ?></strong></div>
                                        </div>
                                        `+discount_group_dropdown+`
                                    </div>
                                 </div
                            </div>`;

                    }else {
                        var text_msg="<?php echo $this->lang->line('no_discount_available');?>";
                          var discount_table=`
                            <div class="checkbox-fees-scroll">
                                <div class="row">
                                    <div class="col-md-12">
                                        <span class="text-danger">`+text_msg+`</span>
                                    </div>
                                 </div
                            </div>`;
                    }

                    $('#set_discount_details').html(discount_table);
            }
                $('#myFeesModal .modal-body .modal_inner_loader').fadeOut(400);
            },
            error: function(xhr) { // if error occured
                alert("<?php echo $this->lang->line('error_occurred_please_try_again'); ?>");
            },
            complete: function() {}
        });
    });

    var fee_amount  = 0;
    var fine_amount = 0;
    $(function () {
        $(document).on('change', '.grp_discount', function () {

            // let selectedDiscounts = [];
            let final_discount_amount=0;
            let balance_amount=fee_type_amount;
            // let balance_amount=parseFloat($("#modal_amount").text());
      
            // Iterate through all checked checkboxes
            $('.grp_discount:checked').each(function () {
                let _this=$(this);
                var amount = _this.data('disamount');
                var type = _this.data('type');
                var percentage = _this.data('percentage');

                if(type == "fix") {
                    final_discount_amount += parseFloat((parseFloat(amount)).toFixed(2));
                }else if(type == "percentage") {
                    var per_amount=((parseFloat(fee_type_amount) * parseFloat(percentage))/100).toFixed(2);
                    final_discount_amount += parseFloat(per_amount);
                }
                balance_amount= (parseFloat(fee_type_amount)-final_discount_amount).toFixed(2);
            });

            $('#myFeesModal input[name="fee_discount"]').val(final_discount_amount);
            $('#myFeesModal input[name="final_amount"]').val(fine_amount);
            $('#myFeesModal input[name="amount"]').val(balance_amount); //new line added


            if (typeof final_discount_amount !== typeof undefined && final_discount_amount !== false) {
                var final_amount=parseFloat(balance_amount)+parseFloat(fine_amount);
                $('div#myFeesModal').find('.modal_discount_amount').text(final_discount_amount);
                $('div#myFeesModal').find('.modal_final_amount').text(parseFloat(final_amount).toFixed(2));
            } else {
                var final_amount=parseFloat(balance_amount)+parseFloat(fine_amount);
                $('div#myFeesModal').find('.modal_discount_amount').text(final_discount_amount);
                $('div#myFeesModal').find('.modal_final_amount').text(parseFloat(final_amount).toFixed(2));
            }
            // selectedDiscounts.push($(this).val());
        });
    });
</script>

<script type="text/javascript">
    $(document).on('click', '.printDoc', function() {
        var main_invoice = $(this).data('main_invoice');
        var sub_invoice = $(this).data('sub_invoice');
        var fee_category = $(this).data('fee-category');
        var student_session_id = '<?php echo $student['student_session_id'] ?>';
        $.ajax({
            url: base_url + 'user/user/printFeesByName',
            type: 'post',
            dataType: "JSON",
            data: {
                'fee_category': fee_category,
                'student_session_id': student_session_id,
                'main_invoice': main_invoice,
                'sub_invoice': sub_invoice
            },
            success: function(response) {
                Popup(response.page);
            }
        });
    });

    $("#select_all").change(function() { //"select all" change
        $('input:checkbox').not(this).prop('checked', this.checked);

    });

    $(document).ready(function() {
        $('#listCollectionModal,#myFeesModal').modal({
            backdrop: 'static',
            keyboard: false,
            show: false
        });

        $(document).on('click', '.printSelected', function() {
            var print_btn = $(this);
            var array_to_print = [];
            $.each($("input[name='fee_checkbox']:checked"), function() {
                var trans_fee_id = $(this).data('trans_fee_id');
                var fee_category = $(this).data('fee_category');

                var fee_session_group_id = $(this).data('fee_session_group_id');
                var fee_master_id = $(this).data('fee_master_id');
                var fee_groups_feetype_id = $(this).data('fee_groups_feetype_id');
                item = {};
                item["fee_category"] = fee_category;
                item["trans_fee_id"] = trans_fee_id;
                item["fee_session_group_id"] = fee_session_group_id;
                item["fee_master_id"] = fee_master_id;
                item["fee_groups_feetype_id"] = fee_groups_feetype_id;

                array_to_print.push(item);
            });
            if (array_to_print.length === 0) {
                errorMsg("<?php echo $this->lang->line('please_select_record'); ?>");
            } else {
                $.ajax({
                    url: '<?php echo site_url("user/user/printFeesByGroupArray") ?>',
                    type: 'post',
                    data: {
                        'data': JSON.stringify(array_to_print)
                    },
                    beforeSend: function() {
                        print_btn.button('loading');
                    },
                    success: function(response) {
                        Popup(response);
                    },
                    error: function(xhr) { // if error occured
                        print_btn.button('reset');
                        errorMsg("<?php echo $this->lang->line('error_occurred_please_try_again'); ?>");

                    },
                    complete: function() {
                        print_btn.button('reset');
                    }
                });
            }
        });

        $(document).on('click', '.collectSelected', function() {
            var $this = $(this);
            var array_to_collect_fees = [];
            var select_count = 0;
            $.each($("input[name='fee_checkbox']:checked"), function() {
                var trans_fee_id = $(this).data('trans_fee_id');
                var fee_category = $(this).data('fee_category');
                var fee_session_group_id = $(this).data('fee_session_group_id');
                var fee_master_id = $(this).data('fee_master_id');
                var fee_groups_feetype_id = $(this).data('fee_groups_feetype_id');
                item = {};
                item["fee_category"] = fee_category;
                item["trans_fee_id"] = trans_fee_id;
                item["fee_session_group_id"] = fee_session_group_id;
                item["fee_master_id"] = fee_master_id;
                item["fee_groups_feetype_id"] = fee_groups_feetype_id;
                array_to_collect_fees.push(item);
                select_count++;
            });

            if (select_count > 0) {
                $.ajax({
                    type: 'POST',
                    url: base_url + "user/user/getcollectfee",
                    data: {
                        'data': JSON.stringify(array_to_collect_fees)
                    },
                    dataType: "JSON",
                    beforeSend: function() {
                        $this.button('loading');
                    },
                    success: function(data) {
                        $("#listCollectionModal .modal-body").html(data.view);
                        $("#listCollectionModal").modal('show');
                        $this.button('reset');
                    },
                    error: function(xhr) { // if error occured
                        alert("<?php echo $this->lang->line('error_occurred_please_try_again'); ?>");

                    },
                    complete: function() {
                        $this.button('reset');
                    }
                });
            } else {
                errorMsg('<?php echo $this->lang->line('please_select_record') ?>');
            }
        });

        $(document).on('click', '.getProcessingfees', function() {
            var $this = $(this);

            $.ajax({
                type: 'POST',
                url: base_url + "user/user/getProcessingfees",

                dataType: "JSON",
                beforeSend: function() {
                    $this.button('loading');
                },
                success: function(data) {

                    $("#processing_fess_modal .modal-body").html(data.view);
                    $("#processing_fess_modal").modal({
                        backdrop: 'static',
                        keyboard: false
                    });
                    $this.button('reset');
                },
                error: function(xhr) { // if error occured
                    alert("<?php echo $this->lang->line('error_occurred_please_try_again'); ?>");

                },
                complete: function() {
                    $this.button('reset');
                }
            });
        });
    });

    var base_url = '<?php echo base_url() ?>';


    function Popup(data, winload = false) {
        var base_url = '<?php echo base_url() ?>';
        var frameDoc = window.open('', 'Print-Window');
        frameDoc.document.open();
        //Create a new HTML document.
        frameDoc.document.write('<html>');
        frameDoc.document.write('<head>');
        frameDoc.document.write('<title></title>');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/bootstrap/css/bootstrap.min.css">');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/dist/css/font-awesome.min.css">');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/dist/css/ionicons.min.css">');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/dist/css/AdminLTE.min.css">');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/dist/css/skins/_all-skins.min.css">');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/plugins/iCheck/flat/blue.css">');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/plugins/morris/morris.css">');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/plugins/jvectormap/jquery-jvectormap-1.2.2.css">');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/plugins/datepicker/datepicker3.css">');
        frameDoc.document.write('<link rel="stylesheet" href="' + base_url + 'backend/plugins/daterangepicker/daterangepicker-bs3.css">');
        frameDoc.document.write('</head>');
        frameDoc.document.write('<body onload="window.print()">');
        frameDoc.document.write(data);
        frameDoc.document.write('</body>');
        frameDoc.document.write('</html>');
        frameDoc.document.close();
        setTimeout(function() {
            frameDoc.close();
            if (winload) {
                window.location.reload(true);
            }
        }, 5000);

        return true;
    }

    $('.detail_popover').popover({
        placement: 'right',
        title: '',
        trigger: 'hover',
        container: 'body',
        html: true,
        content: function() {
            return $(this).closest('td').find('.fee_detail_popover').html();
        }
    });
</script>

<script type="text/javascript">
    function submitform(type, element) {
        $(element).closest("form").find("input[name=submit_mode]").val(type);
        $(element).closest("form").submit();
    }

    $(document).on('click', '.getBankPayments', function() {
        var $this = $(this);
        $.ajax({
            type: 'POST',
            url: base_url + "user/offlinepayment/getBankPayments",

            dataType: "JSON",
            beforeSend: function() {
                $this.button('loading');
            },
            success: function(data) {

                $("#bank_payment_modal .modal-body").html(data.page);
                initDatatable('payment-list', 'user/offlinepayment/getlistbyuser', [], [], 100);
                $("#bank_payment_modal").modal({
                    backdrop: 'static',
                    keyboard: false
                });
                $this.button('reset');
            },
            error: function(xhr) { // if error occured
                alert("<?php echo $this->lang->line('error_occurred_please_try_again'); ?>");
                $this.button('reset');
            },
            complete: function() {
                $this.button('reset');
            }
        });
    });

    $(document).on('click', '.getbankdetail', function() {
        var $this = $(this);
        var recordid = $(this).data('recordid');
        $('.payment_detail', $('#myPaymentModel')).html("");
        $('#myPaymentModel').modal('show');
        $.ajax({
            type: 'POST',
            url: baseurl + "user/offlinepayment/getpayment",
            data: {
                'recordid': recordid
            },
            dataType: 'JSON',
            beforeSend: function() {
                $this.button('loading');
            },
            success: function(data) {
                $('.payment_detail', $('#myPaymentModel')).html(data.page);
                $('.modal_inner_loader').fadeOut("slow");
                $this.button('reset');
            },
            error: function(xhr) { // if error occured
                alert("<?php echo $this->lang->line('error_occurred_please_try_again'); ?>");
                $this.button('reset');
            },
            complete: function() {
                $this.button('reset');
            }
        });
    });
</script>



<script>
//get fees script//
    $(document).on('click', '.save_button', function (e) {
        e.preventDefault(); 
        $(".error").text("");
        var fee_groups_feetype_id       =       $('#myFeesModal input[name="fee_groups_feetype_id"]').val();
        var student_fees_master_id      =       $('#myFeesModal input[name="student_fees_master_id"]').val();
        var student_transport_fee_id    =       $('#myFeesModal input[name="student_transport_fee_id"]').val();
        var student_id                  =       $('#myFeesModal input[name="student_id"]').val();
        var fee_category                =       $('#myFeesModal input[name="fee_category"]').val();
        var fee_discount                =       $('#myFeesModal input[name="fee_discount"]').val();
        var final_amount                =       $('#myFeesModal input[name="final_amount"]').val();
        var amount                      =       $('#myFeesModal input[name="amount"]').val();
        $.ajax({
            url: '<?php echo site_url("user/user/addstudentfee") ?>',
            type: 'post',
            data: {
                fee_groups_feetype_id:fee_groups_feetype_id,
                student_fees_master_id:student_fees_master_id,
                transport_fees_id:student_transport_fee_id,
                final_amount:final_amount,
                amount_discount:fee_discount,
                amount:amount
            },
            dataType: 'json',
            success: function (response) {
                if (response.status === "success") {
                    $('#myformnew').find("input[name=submit_mode]").val('online_payment');
                    $('#myformnew').submit();
                } else if (response.status === "fail") {
                    $.each(response.error, function (index, value) {
                        $('#' + index + '_error').empty().text(value);
                    });
                }
            }
        });
    });
</script>