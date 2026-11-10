#include "mcc_generated_files/mcc.h"

int16_t Joy_Cal_X(adc_result_t NumX);
int16_t Joy_Cal_Y(adc_result_t NumY);

/* Valeurs brutes du joystick au repos, relevees au demarrage */
int16_t ReposX;
int16_t ReposY;

/*
 * TP6 question 1.3 : calibration. 0 au repos, negatif a gauche et en bas, positif a droite et en haut.
 * La valeur brute de Y augmente vers le bas : on inverse l'axe.
 */
void main(void)
{
    SYSTEM_Initialize();

    ReposX = (int16_t)ADCC_GetSingleConversion(JOY_HORZ);
    ReposY = (int16_t)ADCC_GetSingleConversion(JOY_VERT);

    while (1)
    {
        printf("X=%d Y=%d\r\n", Joy_Cal_X(ADCC_GetSingleConversion(JOY_HORZ)), Joy_Cal_Y(ADCC_GetSingleConversion(JOY_VERT)));
        __delay_ms(200);
    }
}

int16_t Joy_Cal_X(adc_result_t NumX)
{
    return (int16_t)NumX - ReposX;
}

int16_t Joy_Cal_Y(adc_result_t NumY)
{
    return ReposY - (int16_t)NumY;
}
