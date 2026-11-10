#include "mcc_generated_files/mcc.h"

typedef struct {
     uint8_t red;
     uint8_t green;
     uint8_t blue;
} rgb_color_t;

void RGBL_SetColor(rgb_color_t color);

/*
 * TP5 question 2 : la couleur est une struct de 3 niveaux sur 8 bits.
 * Le rapport cyclique du PWM est sur 10 bits : niveau x 4 (decalage de 2).
 */
void main(void)
{
    rgb_color_t couleurs[3] = { {255, 0, 0}, {44, 117, 255}, {253, 63, 146} };   // rouge, bleu electrique, fushia
    uint8_t i = 0;

    SYSTEM_Initialize();

    while (1)
    {
        RGBL_SetColor(couleurs[i]);
        printf("R=%u G=%u B=%u\r\n", couleurs[i].red, couleurs[i].green, couleurs[i].blue);
        i++;
        if (i == 3)
        {
            i = 0;
        }
        __delay_ms(985);   // 1 s moins la duree du printf (environ 15 ms a 9600 bauds)
    }
}

void RGBL_SetColor(rgb_color_t color)
{
    PWM6_LoadDutyValue((uint16_t)color.red << 2);     // R
    PWM7_LoadDutyValue((uint16_t)color.green << 2);   // G
    PWM1_LoadDutyValue((uint16_t)color.blue << 2);    // B
}
