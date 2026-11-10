#include "mcc_generated_files/mcc.h"

int16_t Joy_Cal_X(adc_result_t NumX);
int16_t Joy_Cal_Y(adc_result_t NumY);
void IT_Timer2(void);
void IT_CAN(void);

int16_t ReposX;
int16_t ReposY;

/* Partagees entre main et les IT : 16 bits, donc lues avec les IT coupees */
volatile adc_result_t JoyX = 0;
volatile adc_result_t JoyY = 0;
volatile uint8_t voie = 0;   // 0 : conversion X en cours, 1 : conversion Y en cours
volatile uint8_t pret = 0;   // 1 des que X et Y ont ete convertis une fois

/*
 * TP6 question 2 : toutes les 10 ms (TMR2) conversion de X, puis des la fin de X conversion de Y (IT du CAN).
 * Affichage toutes les 1 s dans le main, avec une section critique pour copier les valeurs.
 */
void main(void)
{
    adc_result_t x, y;
    uint8_t n;

    SYSTEM_Initialize();

    TMR2_SetInterruptHandler(IT_Timer2);
    ADCC_SetADIInterruptHandler(IT_CAN);

    INTERRUPT_GlobalInterruptEnable();
    INTERRUPT_PeripheralInterruptEnable();

    // Calibration : premieres valeurs converties, joystick au repos
    while (!pret)
    {
    }
    INTERRUPT_GlobalInterruptDisable();
    ReposX = (int16_t)JoyX;
    ReposY = (int16_t)JoyY;
    INTERRUPT_GlobalInterruptEnable();

    while (1)
    {
        INTERRUPT_GlobalInterruptDisable();
        x = JoyX;
        y = JoyY;
        INTERRUPT_GlobalInterruptEnable();

        printf("X=%d Y=%d\r\n", Joy_Cal_X(x), Joy_Cal_Y(y));

        for (n = 0; n < 10; n++)
        {
            __delay_ms(98);
        }
    }
}

void IT_Timer2(void)
{
    voie = 0;
    ADCC_StartConversion(JOY_HORZ);
}

void IT_CAN(void)
{
    if (voie == 0)
    {
        ADCC_StartConversion(JOY_VERT);   // Y tout de suite
        voie = 1;
        JoyX = ADCC_GetConversionResult();
    }
    else
    {
        JoyY = ADCC_GetConversionResult();
        pret = 1;
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
