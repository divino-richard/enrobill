<?php

namespace App\Enums;

// Application roles. Staff (admin, cashier) use the back-office workspace;
// portal users (student, applicant) use the self-service portal.
enum Role: string
{
    case Admin = 'admin';
    case Cashier = 'cashier';
    case Student = 'student';
    case Applicant = 'applicant';
}
