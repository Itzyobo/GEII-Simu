#include "mcc_generated_files/mcc.h"

/*
 * TP6 question 1.1 : conversion bloquante des 3 entrees analogiques,
 * affichage de la valeur brute et du pourcentage (calcul sur 32 bits : 1023*100 deborde sur 16 bits).
 */
void main(void)
{
    adc_result_t pot, x, y;

    SYSTEM_Initialize();

    while (1)
    {
        pot = ADCC_GetSingleConversion(POT);
        x = ADCC_GetSingleConversion(JOY_HORZ);
        y = ADCC_GetSingleConversion(JOY_VERT);

        printf("POT=%u (%u%%) X=%u (%u%%) Y=%u (%u%%)\r\n",
               pot, (uint16_t)((uint32_t)pot * 100 / 1023),
               x, (uint16_t)((uint32_t)x * 100 / 1023),
               y, (uint16_t)((uint32_t)y * 100 / 1023));

        __delay_ms(200);
    }
}
