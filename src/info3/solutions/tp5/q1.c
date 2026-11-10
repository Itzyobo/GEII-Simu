#include "mcc_generated_files/mcc.h"

/*
 * TP5 question 1 : LED RGB en rouge.
 * R = PWM6 (RD4), G = PWM7 (RC0), B = CCP1 (RC1) ; TMR2 FOSC/4, 1:16, PR2 = 0xFF -> 4,096 ms.
 * Rapport cyclique sur 10 bits : 1023 = 100 %.
 */
void main(void)
{
    SYSTEM_Initialize();

    PWM6_LoadDutyValue(1023);   // rouge a fond
    PWM7_LoadDutyValue(0);      // vert eteint
    PWM1_LoadDutyValue(0);      // bleu eteint

    printf("(R,G,B) = (%d,%d,%d)\r\n", 255, 0, 0);

    while (1)
    {
    }
}
